package com.voicetotext

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

@ReactModule(name = VoiceToTextModule.NAME)
class VoiceToTextModule(reactContext: ReactApplicationContext) :
  NativeVoiceToTextSpec(reactContext) {

  private var speechRecognizer: SpeechRecognizer? = null
  private var recognizerIntent: Intent? = null
  private var recognitionListener: RecognitionListener? = null
  private var isListening = false
  private var sessionDesired = false
  private var manualStopRequested = false
  private var currentLanguageTag: String? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private val eventListeners = HashMap<String, Int>()

  private val restartRunnable = Runnable {
    restartListeningInternal("scheduled_restart")
  }
  private val resultsFallbackRunnable = Runnable {
    if (sessionDesired && !manualStopRequested && !isListening) {
      restartListeningInternal("results_fallback")
    }
  }

  companion object {
    const val NAME = "VoiceToText"
    private const val TAG = "VoiceToTextModule"
    private const val RESTART_DELAY_MS = 550L
    private const val BUSY_RESTART_DELAY_MS = 950L
    private const val RESULTS_FALLBACK_DELAY_MS = 1600L
  }

  init {
    mainHandler.post {
      if (SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
        initializeSpeechRecognizer()
      } else {
        sendErrorEvent("Speech recognition is not available on this device")
      }
    }
  }

  override fun getName(): String = NAME

  private fun currentLocaleTag(): String {
    val tag = currentLanguageTag?.trim()
    if (!tag.isNullOrEmpty()) {
      return tag
    }

    val locale = Locale.getDefault()
    val fallbackTag = locale.toLanguageTag()
    return if (fallbackTag.isNullOrEmpty()) locale.toString() else fallbackTag
  }

  private fun buildRecognizerIntent(): Intent {
    val languageTag = currentLocaleTag()
    return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
      )
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
      putExtra(
        RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
        1500L
      )
      putExtra(
        RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
        1000L
      )
      putExtra(
        RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS,
        1200L
      )
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactApplicationContext.packageName)
    }
  }

  private fun ensureRecognitionListener() {
    if (recognitionListener != null) {
      return
    }

    recognitionListener = object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {
        Log.d(TAG, "onReadyForSpeech")
        clearResultsFallback()
        isListening = true
        sendEvent("onSpeechStart", null)
      }

      override fun onBeginningOfSpeech() {
        Log.d(TAG, "onBeginningOfSpeech")
        sendEvent("onSpeechBegin", null)
      }

      override fun onRmsChanged(rmsdB: Float) {
        if ((eventListeners["onSpeechVolumeChanged"] ?: 0) <= 0) {
          return
        }

        val params = Arguments.createMap()
        params.putDouble("value", rmsdB.toDouble())
        sendEvent("onSpeechVolumeChanged", params)
      }

      override fun onBufferReceived(buffer: ByteArray?) {
        if (buffer == null || (eventListeners["onSpeechAudioBuffer"] ?: 0) <= 0) {
          return
        }

        val params = Arguments.createMap()
        params.putString("buffer", Base64.encodeToString(buffer, Base64.NO_WRAP))
        sendEvent("onSpeechAudioBuffer", params)
      }

      override fun onEndOfSpeech() {
        Log.d(TAG, "onEndOfSpeech")
        isListening = false
        if (sessionDesired && !manualStopRequested) {
          scheduleResultsFallback()
        }
      }

      override fun onError(error: Int) {
        val message = errorMessageForCode(error)
        Log.d(TAG, "onError: $message")
        isListening = false
        clearResultsFallback()

        if (manualStopRequested || !sessionDesired) {
          return
        }

        if (isRecoverableError(error)) {
          scheduleRestart(
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
              BUSY_RESTART_DELAY_MS
            } else {
              RESTART_DELAY_MS
            }
          )
          return
        }

        sessionDesired = false
        sendErrorEvent(message, error)
        sendEvent("onSpeechEnd", null)
      }

      override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val confidence = results?.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)
        val params = Arguments.createMap()

        if (matches != null) {
          val resultsMap = Arguments.createMap()
          val transcriptions = Arguments.createArray()

          for (i in matches.indices) {
            val transcriptionMap = Arguments.createMap()
            transcriptionMap.putString("text", matches[i])
            transcriptionMap.putDouble(
              "confidence",
              if (confidence != null && i < confidence.size) confidence[i].toDouble() else 0.0
            )
            transcriptions.pushMap(transcriptionMap)
          }

          resultsMap.putArray("transcriptions", transcriptions)
          params.putMap("results", resultsMap)
          params.putString("value", matches.firstOrNull() ?: "")
        }

        Log.d(TAG, "onResults: ${matches?.firstOrNull()}")
        isListening = false
        clearResultsFallback()
        sendEvent("onSpeechResults", params)

        if (sessionDesired && !manualStopRequested) {
          scheduleRestart(RESTART_DELAY_MS)
        }
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val params = Arguments.createMap()

        if (matches != null) {
          val resultsMap = Arguments.createMap()
          val transcriptions = Arguments.createArray()

          for (item in matches) {
            val transcriptionMap = Arguments.createMap()
            transcriptionMap.putString("text", item)
            transcriptions.pushMap(transcriptionMap)
          }

          resultsMap.putArray("transcriptions", transcriptions)
          params.putMap("results", resultsMap)
          params.putString("value", matches.firstOrNull() ?: "")
        }

        sendEvent("onSpeechPartialResults", params)
      }

      override fun onEvent(eventType: Int, params: Bundle?) {
        if (params == null) {
          return
        }

        val eventParams = Arguments.createMap()
        eventParams.putInt("eventType", eventType)

        for (key in params.keySet()) {
          when (val value = params.get(key)) {
            is String -> eventParams.putString(key, value)
            is Int -> eventParams.putInt(key, value)
            is Double -> eventParams.putDouble(key, value)
            is Boolean -> eventParams.putBoolean(key, value)
          }
        }

        sendEvent("onSpeechEvent", eventParams)
      }
    }
  }

  private fun destroySpeechRecognizer() {
    try {
      speechRecognizer?.cancel()
    } catch (_: Exception) {
    }

    try {
      speechRecognizer?.destroy()
    } catch (_: Exception) {
    }

    speechRecognizer = null
  }

  private fun initializeSpeechRecognizer() {
    ensureRecognitionListener()
    destroySpeechRecognizer()
    recognizerIntent = buildRecognizerIntent()
    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
    speechRecognizer?.setRecognitionListener(recognitionListener)
  }

  private fun clearScheduledRestarts() {
    mainHandler.removeCallbacks(restartRunnable)
    clearResultsFallback()
  }

  private fun clearResultsFallback() {
    mainHandler.removeCallbacks(resultsFallbackRunnable)
  }

  private fun scheduleResultsFallback() {
    clearResultsFallback()
    if (!sessionDesired || manualStopRequested) {
      return
    }
    mainHandler.postDelayed(resultsFallbackRunnable, RESULTS_FALLBACK_DELAY_MS)
  }

  private fun scheduleRestart(delayMs: Long) {
    clearScheduledRestarts()
    if (!sessionDesired || manualStopRequested) {
      return
    }
    mainHandler.postDelayed(restartRunnable, delayMs)
  }

  private fun restartListeningInternal(reason: String) {
    if (!sessionDesired || manualStopRequested) {
      return
    }
    if (isListening) {
      return
    }

    try {
      initializeSpeechRecognizer()
      speechRecognizer?.startListening(recognizerIntent)
      isListening = true
      Log.d(TAG, "restartListeningInternal: $reason")
    } catch (e: Exception) {
      Log.e(TAG, "restartListeningInternal failure", e)
      scheduleRestart(BUSY_RESTART_DELAY_MS)
    }
  }

  private fun sendEvent(eventName: String, params: Any?) {
    try {
      reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    } catch (e: Exception) {
      Log.e(TAG, "Error sending event: $eventName", e)
    }
  }

  private fun sendErrorEvent(message: String, code: Int? = null) {
    val params = Arguments.createMap()
    params.putString("message", message)
    if (code != null) {
      params.putInt("code", code)
    }
    sendEvent("onSpeechError", params)
  }

  private fun isRecoverableError(error: Int): Boolean {
    return when (error) {
      SpeechRecognizer.ERROR_NO_MATCH,
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
      SpeechRecognizer.ERROR_CLIENT -> true
      else -> false
    }
  }

  private fun errorMessageForCode(error: Int): String {
    return when (error) {
      SpeechRecognizer.ERROR_NETWORK -> "Network error"
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
      SpeechRecognizer.ERROR_NO_MATCH -> "No speech match found"
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer is busy"
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
      SpeechRecognizer.ERROR_SERVER -> "Server error"
      SpeechRecognizer.ERROR_CLIENT -> "Client error"
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
      SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
      else -> "Unknown error: $error"
    }
  }

  @ReactMethod
  override fun startListening(promise: Promise) {
    if (
      ContextCompat.checkSelfPermission(
        reactApplicationContext,
        Manifest.permission.RECORD_AUDIO
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      promise.reject("PERMISSION_DENIED", "Audio recording permission not granted")
      return
    }

    mainHandler.post {
      if (!SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
        promise.reject("NOT_AVAILABLE", "Speech recognition is not available on this device")
        return@post
      }

      sessionDesired = true
      manualStopRequested = false
      clearScheduledRestarts()

      if (isListening) {
        promise.resolve("Already listening")
        return@post
      }

      try {
        initializeSpeechRecognizer()
        speechRecognizer?.startListening(recognizerIntent)
        isListening = true
        promise.resolve("Started listening")
      } catch (e: Exception) {
        Log.e(TAG, "startListening failure", e)
        sessionDesired = false
        manualStopRequested = false
        promise.reject("ERROR", "Error starting speech recognition: ${e.message}")
      }
    }
  }

  @ReactMethod
  override fun stopListening(promise: Promise) {
    mainHandler.post {
      manualStopRequested = true
      sessionDesired = false
      clearScheduledRestarts()
      isListening = false

      try {
        speechRecognizer?.stopListening()
      } catch (_: Exception) {
      }

      try {
        speechRecognizer?.cancel()
      } catch (_: Exception) {
      }

      sendEvent("onSpeechEnd", null)
      promise.resolve("Stopped listening")
    }
  }

  @ReactMethod
  override fun destroy(promise: Promise) {
    mainHandler.post {
      manualStopRequested = true
      sessionDesired = false
      clearScheduledRestarts()
      isListening = false
      destroySpeechRecognizer()
      eventListeners.clear()
      promise.resolve("Speech recognizer destroyed")
    }
  }

  @ReactMethod
  override fun addListener(eventName: String) {
    val count = eventListeners.getOrDefault(eventName, 0)
    eventListeners[eventName] = count + 1
  }

  @ReactMethod
  override fun removeListeners(count: Double) {
    val countInt = count.toInt()
    val keys = eventListeners.keys.toList()
    for (eventName in keys) {
      val currentCount = eventListeners[eventName] ?: 0
      val nextCount = maxOf(0, currentCount - countInt)
      if (nextCount > 0) {
        eventListeners[eventName] = nextCount
      } else {
        eventListeners.remove(eventName)
      }
    }
  }

  @ReactMethod
  override fun getRecognitionLanguage(promise: Promise) {
    promise.resolve(currentLocaleTag())
  }

  @ReactMethod
  override fun setRecognitionLanguage(languageTag: String, promise: Promise) {
    mainHandler.post {
      currentLanguageTag = languageTag
      recognizerIntent = buildRecognizerIntent()
      promise.resolve(true)
    }
  }

  @ReactMethod
  override fun isRecognitionAvailable(promise: Promise) {
    promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
  }

  @ReactMethod
  override fun getSupportedLanguages(promise: Promise) {
    try {
      val languages = Arguments.createArray()
      listOf(
        "en-US", "en-GB", "fr-FR", "de-DE", "it-IT", "es-ES",
        "ja-JP", "ko-KR", "zh-CN", "ru-RU", "pt-BR", "nl-NL",
        "hi-IN", "ar-SA"
      ).forEach { language ->
        languages.pushString(language)
      }
      promise.resolve(languages)
    } catch (e: Exception) {
      promise.reject("LANGUAGES_ERROR", "Error getting supported languages: ${e.message}")
    }
  }
}

package com.aicloudsolutions.cloud

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

internal const val SPLASH_FAIL_SAFE_MS = 10_000L

internal object StartupSplashState {
  @Volatile private var ready = false
  private var readyListener: (() -> Unit)? = null

  @Synchronized
  fun reset() {
    ready = false
    readyListener = null
  }

  fun markReady() {
    var listener: (() -> Unit)? = null
    synchronized(this) {
      ready = true
      listener = readyListener
      readyListener = null
    }
    listener?.invoke()
  }

  fun runWhenReady(listener: () -> Unit) {
    var runNow = false
    synchronized(this) {
      if (ready) {
        runNow = true
      } else {
        readyListener = listener
      }
    }
    if (runNow) listener()
  }
}

private class StartupSplashModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "StartupSplash"

  @ReactMethod
  fun markReady() {
    reactApplicationContext.runOnUiQueueThread {
      StartupSplashState.markReady()
    }
  }
}

class StartupSplashPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(StartupSplashModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}

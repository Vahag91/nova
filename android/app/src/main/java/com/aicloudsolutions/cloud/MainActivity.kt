package com.aicloudsolutions.cloud

import android.graphics.drawable.Animatable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.appcompat.content.res.AppCompatResources
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Reset before React creates its surface. The system starting window may
    // draw immediately; its copied exit surface stays above React until the
    // destination has committed a complete first frame.
    StartupSplashState.reset()
    val splashScreen = installSplashScreen()

    // Must be configured before super.onCreate().
    // Prevents Android from restoring incompatible react-native-screens fragments.
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()

    super.onCreate(savedInstanceState)

    // Draw an app-owned native loader immediately. Its first frame lets the
    // platform splash leave before MIUI can stop the system-managed AVD, while
    // React continues mounting behind this complete, opaque surface.
    val splashOverlay = FrameLayout(this).apply {
      setBackgroundColor(ContextCompat.getColor(context, R.color.brand_background))
      isClickable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    }
    val loaderView = ImageView(this).apply {
      setImageDrawable(
        AppCompatResources.getDrawable(context, R.drawable.launch_loader_animated)
      )
      scaleType = ImageView.ScaleType.CENTER
    }
    val loaderCanvasSize = (288f * resources.displayMetrics.density).toInt()
    splashOverlay.addView(
      loaderView,
      FrameLayout.LayoutParams(
        loaderCanvasSize,
        loaderCanvasSize,
        Gravity.CENTER
      )
    )
    addContentView(
      splashOverlay,
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )

    val loaderAnimation = (loaderView.drawable as? Animatable)?.also { it.start() }

    // The app-owned overlay is already underneath and visually identical.
    splashScreen.setOnExitAnimationListener { splashView -> splashView.remove() }

    var dismissed = false
    val dismissSplash: () -> Unit = {
      if (!dismissed) {
        dismissed = true
        loaderAnimation?.stop()
        splashOverlay.animate()
          .alpha(0f)
          .setDuration(140L)
          .withEndAction {
            (splashOverlay.parent as? ViewGroup)?.removeView(splashOverlay)
          }
          .start()
      }
    }

    StartupSplashState.runWhenReady {
      splashOverlay.post { dismissSplash() }
    }
    splashOverlay.postDelayed({ dismissSplash() }, SPLASH_FAIL_SAFE_MS)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }

    WindowCompat.getInsetsController(window, window.decorView)?.let { controller ->
      controller.isAppearanceLightStatusBars = false
      controller.isAppearanceLightNavigationBars = false
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   */
  override fun getMainComponentName(): String = "ChatCloud"

  /**
   * Returns the React activity delegate.
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(
          this,
          mainComponentName,
          fabricEnabled
      )
}

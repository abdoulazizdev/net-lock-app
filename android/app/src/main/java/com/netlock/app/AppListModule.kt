package com.netlock.app

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class AppListModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "AppListModule"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)
      val array = WritableNativeArray()

      for (pkg in packages) {
        val map = WritableNativeMap()
        map.putString("packageName", pkg.packageName)
        map.putString("appName", pm.getApplicationLabel(pkg).toString())
        map.putBoolean("isSystemApp", pkg.flags and ApplicationInfo.FLAG_SYSTEM != 0)

        // ✅ Icône en base64
        try {
          val icon: Drawable = pm.getApplicationIcon(pkg.packageName)
          val base64Icon = drawableToBase64(icon)
          map.putString("icon", base64Icon)
        } catch (e: Exception) {
          map.putNull("icon")
        }

        array.pushMap(map)
      }
      promise.resolve(array)
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  private fun drawableToBase64(drawable: Drawable): String {
    val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
      drawable.bitmap
    } else {
      val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 96
      val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 96
      val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bmp)
      drawable.setBounds(0, 0, canvas.width, canvas.height)
      drawable.draw(canvas)
      bmp
    }

    val stream = ByteArrayOutputStream()
    // Réduit la taille : 64x64 suffit pour une liste
    val scaled = Bitmap.createScaledBitmap(bitmap, 96, 96, true)
    scaled.compress(Bitmap.CompressFormat.PNG, 80, stream)
    return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
  }
}
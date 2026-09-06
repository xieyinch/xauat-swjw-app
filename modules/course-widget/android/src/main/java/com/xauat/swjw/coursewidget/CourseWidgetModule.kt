package com.xauat.swjw.coursewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class CourseWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CourseWidget")

    AsyncFunction("updateCourseWidget") { payload: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      WidgetData.save(context, payload)
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, CourseWidgetProvider::class.java))
      CourseWidgetProvider.updateAll(context, manager, ids)
    }

    AsyncFunction("getDynamicColors") {
      readAccentJson()
    }

    Function("getDynamicColorsSync") {
      readAccentJson()
    }
  }

  private fun readAccentJson(): String? {
    val context = appContext.reactContext ?: return null
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
    return try {
      val accent = JSONObject()
      val buckets = listOf(
        "a1" to "system_accent1_",
        "a2" to "system_accent2_",
        "n1" to "system_neutral1_",
        "n2" to "system_neutral2_"
      )
      val tones = intArrayOf(300, 400, 500, 600, 700, 800, 900)
      for ((bucket, prefix) in buckets) {
        for (tone in tones) {
          val color = dynamicResourceColor(context, prefix + tone) ?: continue
          accent.put(bucket + tone, String.format("#%06X", 0xFFFFFF and color))
        }
      }
      accent.toString()
    } catch (e: Exception) {
      null
    }
  }

  /** 反射读取动态取色资源，避免直接引用低版本不存在/编译期缺失的资源常量 */
  private fun dynamicResourceColor(context: Context, resourceName: String): Int? {
    return try {
      val field = android.R.color::class.java.getField(resourceName)
      val id = field.getInt(null)
      context.getColor(id)
    } catch (e: Exception) {
      null
    }
  }
}

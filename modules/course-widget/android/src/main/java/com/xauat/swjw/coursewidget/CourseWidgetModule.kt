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
    // 优先复用桌面组件持久化的色板，保证 App 与小组件使用同一份动态色
    try {
      val cached = context.getSharedPreferences("course_widget", Context.MODE_PRIVATE)
        .getString("material_accent", null)
      if (!cached.isNullOrEmpty()) return cached
    } catch (e: Exception) {
      // 忽略，回退到实时读取
    }
    return try {
      val accent = JSONObject()
      for ((bucket, tones) in MaterialYou.bucketTones) {
        for ((tone, colorId) in tones) {
          val color = try {
            context.getColor(colorId)
          } catch (e: Exception) {
            continue
          }
          accent.put(bucket + tone, String.format("#%06X", 0xFFFFFF and color))
        }
      }
      if (accent.length() > 0) {
        context.getSharedPreferences("course_widget", Context.MODE_PRIVATE)
          .edit()
          .putString("material_accent", accent.toString())
          .apply()
      }
      accent.toString()
    } catch (e: Exception) {
      null
    }
  }

  private object MaterialYou {
    private val a1 = mapOf(
      300 to android.R.color.system_accent1_300,
      400 to android.R.color.system_accent1_400,
      500 to android.R.color.system_accent1_500,
      600 to android.R.color.system_accent1_600,
      700 to android.R.color.system_accent1_700,
      800 to android.R.color.system_accent1_800,
      900 to android.R.color.system_accent1_900,
    )
    private val a2 = mapOf(
      300 to android.R.color.system_accent2_300,
      400 to android.R.color.system_accent2_400,
      500 to android.R.color.system_accent2_500,
      600 to android.R.color.system_accent2_600,
      700 to android.R.color.system_accent2_700,
      800 to android.R.color.system_accent2_800,
      900 to android.R.color.system_accent2_900,
    )
    private val n1 = mapOf(
      300 to android.R.color.system_neutral1_300,
      400 to android.R.color.system_neutral1_400,
      500 to android.R.color.system_neutral1_500,
      600 to android.R.color.system_neutral1_600,
      700 to android.R.color.system_neutral1_700,
      800 to android.R.color.system_neutral1_800,
      900 to android.R.color.system_neutral1_900,
    )
    private val n2 = mapOf(
      300 to android.R.color.system_neutral2_300,
      400 to android.R.color.system_neutral2_400,
      500 to android.R.color.system_neutral2_500,
      600 to android.R.color.system_neutral2_600,
      700 to android.R.color.system_neutral2_700,
      800 to android.R.color.system_neutral2_800,
      900 to android.R.color.system_neutral2_900,
    )

    val bucketTones: List<Pair<String, Map<Int, Int>>> = listOf(
      "a1" to a1,
      "a2" to a2,
      "n1" to n1,
      "n2" to n2,
    )
  }
}

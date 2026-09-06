package com.xauat.swjw.coursewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
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

    AsyncFunction("getDynamicColors") { ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@AsyncFunction null
      try {
        val accent = JSONObject()
        val tones = intArrayOf(300, 400, 500, 600, 700, 800, 900)
        for (tone in tones) {
          val id = accentColorId(tone) ?: continue
          val color = context.getColor(id)
          accent.put(tone.toString(), String.format("#%06X", 0xFFFFFF and color))
        }
        return@AsyncFunction accent.toString()
      } catch (e: Exception) {
        null
      }
    }
  }

  private fun accentColorId(tone: Int): Int? = when (tone) {
    300 -> android.R.color.system_accent1_300
    400 -> android.R.color.system_accent1_400
    500 -> android.R.color.system_accent1_500
    600 -> android.R.color.system_accent1_600
    700 -> android.R.color.system_accent1_700
    800 -> android.R.color.system_accent1_800
    900 -> android.R.color.system_accent1_900
    else -> null
  }
}

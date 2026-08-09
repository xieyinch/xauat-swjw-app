package com.xauat.swjw.coursewidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
  }
}

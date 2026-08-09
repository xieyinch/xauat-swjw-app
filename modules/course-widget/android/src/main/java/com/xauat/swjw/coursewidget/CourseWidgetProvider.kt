package com.xauat.swjw.coursewidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

class CourseWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    updateAll(context, appWidgetManager, appWidgetIds)
  }

  companion object {
    private val DAY_LABELS = listOf("周一", "周二", "周三", "周四", "周五", "周六", "周日")

    fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val payload = WidgetData.parse(WidgetData.load(context))
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.course_widget)
        views.setTextViewText(R.id.widget_header, payload.header)
        for (i in 0 until 7) {
          views.setTextViewText(dayId(i), DAY_LABELS[i])
          views.setTextViewText(coursesId(i), payload.courses[i])
        }
        manager.updateAppWidget(id, views)
      }
    }

    private fun dayId(index: Int): Int = when (index) {
      0 -> R.id.widget_day_1
      1 -> R.id.widget_day_2
      2 -> R.id.widget_day_3
      3 -> R.id.widget_day_4
      4 -> R.id.widget_day_5
      5 -> R.id.widget_day_6
      else -> R.id.widget_day_7
    }

    private fun coursesId(index: Int): Int = when (index) {
      0 -> R.id.widget_courses_1
      1 -> R.id.widget_courses_2
      2 -> R.id.widget_courses_3
      3 -> R.id.widget_courses_4
      4 -> R.id.widget_courses_5
      5 -> R.id.widget_courses_6
      else -> R.id.widget_courses_7
    }
  }
}

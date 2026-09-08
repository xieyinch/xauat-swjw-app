import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { schoolDateKey } from '../api/semester';

/** Re-evaluate the default term and today's courses after midnight or returning to the app. */
export function useSchoolDay() {
  const [day, setDay] = useState(() => schoolDateKey());
  useEffect(() => {
    const update = () => setDay(schoolDateKey());
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return day;
}

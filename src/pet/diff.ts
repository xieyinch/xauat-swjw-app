export function changedKeys(previous: Record<string,string> | null, next:Record<string,string>) {
  return previous ? Object.keys(next).filter(key=>previous[key]!==next[key]) : [];
}

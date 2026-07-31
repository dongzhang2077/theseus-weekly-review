const TIME_CHART_COLORS = [
  "#5f7f5b",
  "#6b879d",
  "#b07b45",
  "#8a7195",
  "#a35f56",
  "#647f78",
] as const;

export function timeChartColor(key: string): string {
  let hash = 0;
  for (const character of key) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return TIME_CHART_COLORS[Math.abs(hash) % TIME_CHART_COLORS.length];
}

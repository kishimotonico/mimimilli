/** スキャン結果 */
export interface ScanResult {
  registered: number;
  newlyGenerated: number;
  errors: number;
  missing: number;
  newWorkIds: string[];
}

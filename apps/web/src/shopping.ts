export function shouldCollapseShoppingLine(line: { included: boolean; selectedOfferId?: string | null }) {
  return !line.included || Boolean(line.selectedOfferId);
}

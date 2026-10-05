import { useState } from 'react';
import type { ProductOffer, ShoppingComparison, ShoppingLine } from '@home-meal-planner/contracts';
import { api } from './api';
import { getOfferAssessment, incompleteSelectedLines, shouldCollapseShoppingLine } from './shopping';

type LinePatch = { included?: boolean; selectedOfferId?: string | null };
const money = (amount: number, currency?: string) => `${amount.toFixed(2)} ${currency ?? ''}`.trim();

export function ShoppingPage({ comparison, setComparison, onRefresh, onError }: {
  comparison?: ShoppingComparison;
  setComparison: (comparison: ShoppingComparison) => void;
  onRefresh: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [expandedLineIds, setExpandedLineIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const updateLine = async (lineId: string, patch: LinePatch) => {
    if (!comparison || pending) return;
    setPending(true);
    try {
      const next = await api<ShoppingComparison>(`/api/shopping-comparisons/${comparison.id}/lines/${lineId}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setComparison(next);
      if (patch.selectedOfferId !== undefined || patch.included === false) {
        setExpandedLineIds((current) => { const next = new Set(current); next.delete(lineId); return next; });
      }
    } catch (error) { onError(error); } finally { setPending(false); }
  };
  const toggleLine = (id: string) => setExpandedLineIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const showLine = (id: string) => {
    setExpandedLineIds((current) => new Set([...current, id]));
    document.getElementById(`shopping-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  if (!comparison) return <section className="empty-state"><h3>No comparison yet.</h3><p>Open your meal plan and ask the enabled stores what is available.</p></section>;

  const selectedByStore = new Map<string, { line: ShoppingLine; offer: ProductOffer }[]>();
  for (const line of comparison.lines) {
    if (!line.included || !line.selectedOfferId) continue;
    const offer = line.offers.find((offer) => offer.id === line.selectedOfferId);
    if (offer) selectedByStore.set(offer.storeId, [...(selectedByStore.get(offer.storeId) ?? []), { line, offer }]);
  }
  const renderOffers = (line: ShoppingLine, group: 'exact-brand' | 'alternative', label: string) => {
    const offers = line.offers.filter((offer) => getOfferAssessment(comparison, line, offer.id)?.group === group);
    if (!offers.length) return null;
    return <div className="offer-group"><h5>{label}</h5><div className="offer-list">{offers.map((offer) => {
      const assessment = getOfferAssessment(comparison, line, offer.id);
      const calculation = assessment?.status === 'complete'
        ? `${offer.priceBasis === 'package' ? `Buy ${assessment.packagesNeeded} pack(s)` : 'Buy by quantity'} / total ${money(assessment.purchaseCost!, offer.currency)} / ${assessment.purchasedQuantity} ${line.requiredUnit ?? ''} purchased / excess ${assessment.excessQuantity ?? 0} ${line.requiredUnit ?? ''}`
        : assessment?.reason ?? 'Refresh this comparison to calculate the cost.';
      const isSelected = line.selectedOfferId === offer.id;
      return <div className={`offer ${isSelected ? 'checked' : ''} ${assessment?.status === 'incomplete' ? 'incomplete' : ''}`} key={offer.id}>
        <input type="radio" name={line.id} aria-label={`Select ${offer.title} for ${line.ingredient.name}`} checked={isSelected} disabled={!line.included || pending} onChange={() => updateLine(line.id, { selectedOfferId: offer.id })} />
        <span className="offer-main"><strong>{offer.title}</strong><small>{offer.storeId} / {offer.brand ? `${offer.brand} / ` : ''}{offer.packageQuantity ? `${offer.packageQuantity} ${offer.packageUnit}` : offer.priceBasis ?? 'unknown'} / basis: {offer.priceBasis ?? 'unknown'}{offer.priceBasisAssumed ? ' (estimated pack size)' : ''} / {offer.provenance} / {offer.availability} / fetched: {offer.fetchedAt ? new Date(offer.fetchedAt).toLocaleString() : 'not provided'}</small><small>{calculation}</small>{assessment?.normalizedUnitPrice != null && <small>Unit price: {assessment.normalizedUnitPrice.toFixed(4)} {offer.currency}/{line.requiredUnit}</small>}</span>
        <span className="offer-price">{offer.price != null ? money(offer.price, offer.currency) : 'unknown'}<small>{assessment?.status === 'complete' ? 'ranked' : 'Needs review'}</small><button type="button" className="offer-select" disabled={!line.included || pending || isSelected} onClick={() => updateLine(line.id, { selectedOfferId: offer.id })}>{isSelected ? 'Selected' : 'Select'}</button></span>
      </div>;
    })}</div></div>;
  };

  return <section>
    <div className="section-heading"><div><div className="eyebrow">PRICE SNAPSHOT / {new Date(comparison.createdAt).toLocaleString()}</div><h3>Choose what comes home.</h3></div><button className="secondary" onClick={() => onRefresh().catch(onError)}>Refresh stores</button></div>
    <div className="comparison-layout"><div className="shopping-lines">{comparison.lines.map((line) => {
      const selected = line.offers.find((offer) => offer.id === line.selectedOfferId);
      const assessment = selected ? getOfferAssessment(comparison, line, selected.id) : undefined;
      const collapsed = !expandedLineIds.has(line.id) && shouldCollapseShoppingLine(line);
      return <article className={`shopping-line ${collapsed ? 'collapsed' : ''}`} id={`shopping-${line.id}`} key={line.id}>
        <div className="line-header"><label className="check-label"><input type="checkbox" checked={line.included} disabled={pending} onChange={(event) => updateLine(line.id, { included: event.target.checked })} /><span>{line.ingredient.name}</span></label><span className="required">{line.requiredQuantity ?? 'Amount needed'} {line.requiredUnit ?? ''}</span><button type="button" className="line-toggle" onClick={() => toggleLine(line.id)}>{collapsed ? 'Change' : 'Done'}</button></div>
        {collapsed ? <div className="collapsed-line-summary"><span className={line.included ? 'collapsed-status' : 'collapsed-status excluded'}>{line.included ? 'Selected product' : 'Excluded from shopping'}</span>{selected && <span className="collapsed-product"><strong>{selected.title}</strong><small>{selected.storeId} / {assessment?.status === 'complete' && assessment.purchaseCost != null ? `${money(assessment.purchaseCost, selected.currency)} estimated purchase cost` : 'Needs review'}</small>{line.included && assessment?.status !== 'complete' && <small className="shopping-issue">{assessment?.reason ?? 'Refresh this comparison to calculate the cost.'}</small>}</span>}</div>
          : <>{line.requiredQuantity == null || line.requiredUnit == null ? <p className="shopping-issue">Amount and unit come from the recipe. Edit the recipe, then refresh this comparison.</p> : null}{selected && <button type="button" className="text-button" onClick={() => updateLine(line.id, { selectedOfferId: null })}>Clear selection</button>}{line.offers.length ? <>{renderOffers(line, 'exact-brand', 'Exact requested brand')}{renderOffers(line, 'alternative', 'Alternative brands')}</> : <p className="muted small">No matching products found. Try a manual store search.</p>}</>}
      </article>;
    })}</div><aside className="order-panel"><div className="eyebrow">SELECTED SHOPPING LINKS</div><h3>Split by store</h3>
      {selectedByStore.size === 0 && <p className="muted">Select products to see the handoff list.</p>}
      {[...selectedByStore].map(([storeId, items]) => <div className="store-group" key={storeId}><h4>{storeId}</h4>{items.map(({ line, offer }) => <a href={offer.productUrl} target="_blank" rel="noreferrer" key={line.id}>{offer.title}<span>↗</span></a>)}</div>)}
      {comparison.subtotals.map((subtotal) => <div key={subtotal.storeId}>
        <div className="subtotal"><span>{subtotal.storeId}</span><strong>{subtotal.status === 'complete' ? money(subtotal.total!, subtotal.currency) : `Incomplete — ${subtotal.incompleteLineCount} need review`}</strong></div>
        {subtotal.status === 'incomplete' && <div className="subtotal-issues"><p>Known items: {money(subtotal.knownTotal ?? 0, subtotal.currency)}. The full total needs:</p>{incompleteSelectedLines(comparison, subtotal.storeId).map(({ line, reason }) => <div key={line.id}><button type="button" className="text-button" onClick={() => showLine(line.id)}>{line.ingredient.name}</button><small>{reason}</small></div>)}</div>}
      </div>)}
      <p className="fine-print">Product prices are snapshots. Delivery fees and minimum baskets are not included.</p>
    </aside></div>
  </section>;
}

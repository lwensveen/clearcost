import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { callQuote, formatMoney } from './index.js';
import type { QuoteBody, SDK } from './index.js';

type QuoteResult = {
  components: { CIF: number; duty: number; vat: number; fees: number; checkoutVAT?: number };
  total: number;
  incoterm?: string;
  currency?: string;
  itemValue?: number;
};

@Component({
  selector: 'clearcost-quote',
  standalone: true,
  template: `
    <div class="cc-wrap">
      <button class="cc-btn" (click)="calculate()" [disabled]="loading">
        {{ loading ? 'Calculating…' : hasRun ? 'Recalculate' : 'Estimate duties & taxes' }}
      </button>

      @if (error) {
        <div class="cc-result" style="color:#dc2626">Failed: {{ error }}</div>
      }

      @if (quote) {
        <div class="cc-result">
          <div class="cc-header">
            <strong>Landed cost</strong>
            <span class="cc-header-total">{{ money(quote.total) }}</span>
          </div>
          <div class="cc-rows">
            <div class="cc-row">
              <span>Freight</span>
              <span>{{ money(freight) }}</span>
            </div>
            <div class="cc-row">
              <span>Duty</span>
              <span>{{ money(quote.components.duty || 0) }}</span>
            </div>
            <div class="cc-row">
              <span>VAT</span>
              <span>{{ money(quote.components.vat || 0) }}</span>
            </div>
            @if (quote.components.checkoutVAT !== undefined) {
              <div class="cc-row">
                <span>Checkout VAT (IOSS)</span>
                <span>{{ money(quote.components.checkoutVAT || 0) }}</span>
              </div>
            }
            <div class="cc-row">
              <span>Fees</span>
              <span>{{ money(quote.components.fees || 0) }}</span>
            </div>
            <div class="cc-incoterm">
              Incoterm: <strong>{{ quote.incoterm ?? 'DAP' }}</strong>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClearCostQuoteComponent implements OnInit {
  @Input() origin!: string;
  @Input() dest!: string;
  @Input() price!: number;
  @Input() currency = 'USD';
  @Input() l!: number;
  @Input() w!: number;
  @Input() h!: number;
  @Input() weight!: number;
  @Input() categoryKey = 'general';
  @Input() hs6?: string;
  @Input() mode: 'air' | 'sea' = 'air';
  @Input() proxyUrl?: string;
  @Input() baseUrl?: string;
  @Input() apiKey?: string;
  @Input() auto = false;
  @Input() locale = 'en-US';

  quote: QuoteResult | null = null;
  loading = false;
  error: string | null = null;
  hasRun = false;

  get freight(): number {
    if (!this.quote) return 0;
    return Number(this.quote.components.CIF || 0) - this.price;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    if (this.auto) void this.calculate();
  }

  money(x: number): string {
    return formatMoney(Number(x) || 0, this.currency.toUpperCase(), this.locale);
  }

  async calculate() {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    try {
      const body: QuoteBody = {
        origin: this.origin,
        dest: this.dest,
        itemValue: { amount: this.price, currency: this.currency },
        dimsCm: { l: this.l, w: this.w, h: this.h },
        weightKg: this.weight,
        categoryKey: this.categoryKey,
        hs6: this.hs6,
        mode: this.mode,
      };
      const sdk: SDK = {
        proxyUrl: this.proxyUrl,
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
      };
      const q = await callQuote(body, sdk);
      q.itemValue = this.price;
      this.quote = q;
      this.hasRun = true;
    } catch (e: any) {
      this.error = e?.message ?? 'Request failed';
      this.hasRun = true;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}

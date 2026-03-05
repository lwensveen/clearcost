import { defineComponent, ref, onMounted, h, type PropType } from 'vue';
import { callQuote, formatMoney } from './index.js';
import type { QuoteBody, SDK } from './index.js';

type QuoteResult = {
  components: { CIF: number; duty: number; vat: number; fees: number; checkoutVAT?: number };
  total: number;
  incoterm?: string;
  currency?: string;
  itemValue?: number;
};

export const ClearCostQuote = defineComponent({
  name: 'ClearCostQuote',
  props: {
    origin: { type: String, required: true },
    dest: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    l: { type: Number, required: true },
    w: { type: Number, required: true },
    h: { type: Number, required: true },
    weight: { type: Number, required: true },
    categoryKey: { type: String, default: 'general' },
    hs6: { type: String as PropType<string | undefined>, default: undefined },
    mode: { type: String as PropType<'air' | 'sea'>, default: 'air' },
    proxyUrl: { type: String as PropType<string | undefined>, default: undefined },
    baseUrl: { type: String as PropType<string | undefined>, default: undefined },
    apiKey: { type: String as PropType<string | undefined>, default: undefined },
    auto: { type: Boolean, default: false },
    locale: { type: String, default: 'en-US' },
  },
  setup(props) {
    const quote = ref<QuoteResult | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const hasRun = ref(false);

    async function calculate() {
      loading.value = true;
      error.value = null;
      try {
        const body: QuoteBody = {
          origin: props.origin,
          dest: props.dest,
          itemValue: { amount: props.price, currency: props.currency },
          dimsCm: { l: props.l, w: props.w, h: props.h },
          weightKg: props.weight,
          categoryKey: props.categoryKey,
          hs6: props.hs6,
          mode: props.mode,
        };
        const sdk: SDK = {
          proxyUrl: props.proxyUrl,
          baseUrl: props.baseUrl,
          apiKey: props.apiKey,
        };
        const q = await callQuote(body, sdk);
        q.itemValue = props.price;
        quote.value = q;
        hasRun.value = true;
      } catch (e: any) {
        error.value = e?.message ?? 'Request failed';
        hasRun.value = true;
      } finally {
        loading.value = false;
      }
    }

    onMounted(() => {
      if (props.auto) void calculate();
    });

    return { quote, loading, error, hasRun, calculate };
  },
  render() {
    const { quote, loading, error, hasRun, calculate } = this;
    const cur = (this.currency ?? 'USD').toUpperCase();
    const locale = this.locale ?? 'en-US';
    const money = (x: number) => formatMoney(Number(x) || 0, cur, locale);
    const price = this.price;

    const row = (label: string, amount: number) =>
      h('div', { class: 'cc-row' }, [h('span', null, label), h('span', null, money(amount))]);

    const children: any[] = [
      h(
        'button',
        { class: 'cc-btn', onClick: calculate, disabled: loading },
        loading ? 'Calculating\u2026' : hasRun ? 'Recalculate' : 'Estimate duties & taxes'
      ),
    ];

    if (error) {
      children.push(h('div', { class: 'cc-result', style: 'color:#dc2626' }, `Failed: ${error}`));
    }

    if (quote) {
      const rows: any[] = [
        row('Freight', Number(quote.components.CIF || 0) - price),
        row('Duty', Number(quote.components.duty || 0)),
        row('VAT', Number(quote.components.vat || 0)),
      ];
      if (quote.components.checkoutVAT !== undefined) {
        rows.push(row('Checkout VAT (IOSS)', Number(quote.components.checkoutVAT || 0)));
      }
      rows.push(row('Fees', Number(quote.components.fees || 0)));
      rows.push(
        h('div', { class: 'cc-incoterm' }, [
          'Incoterm: ',
          h('strong', null, quote.incoterm ?? 'DAP'),
        ])
      );

      children.push(
        h('div', { class: 'cc-result' }, [
          h('div', { class: 'cc-header' }, [
            h('strong', null, 'Landed cost'),
            h('span', { class: 'cc-header-total' }, money(quote.total)),
          ]),
          h('div', { class: 'cc-rows' }, rows),
        ])
      );
    }

    return h('div', { class: 'cc-wrap' }, children);
  },
});

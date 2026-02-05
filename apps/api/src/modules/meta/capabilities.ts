import { commands } from '../../lib/cron/registry.js';

type DatasetKey =
  | 'duties'
  | 'vat'
  | 'de-minimis'
  | 'surcharges'
  | 'hs-aliases'
  | 'freight'
  | 'fx'
  | 'notices';

const SCHEDULED_BY_DATASET: Record<DatasetKey, boolean> = {
  duties: true,
  vat: true,
  'de-minimis': true,
  surcharges: true,
  'hs-aliases': true,
  freight: false,
  fx: true,
  notices: true,
};

const FRESHNESS_THRESHOLD_HOURS: Record<DatasetKey, number | null> = {
  duties: 192,
  vat: 48,
  'de-minimis': 48,
  surcharges: 192,
  'hs-aliases': 192,
  freight: null,
  fx: 30,
  notices: 48,
};

const REGION_PREFIX_MAP: Array<[prefix: string, region: string]> = [
  ['eu', 'EU'],
  ['us', 'US'],
  ['uk', 'UK'],
  ['jp', 'JP'],
  ['cn', 'CN'],
  ['id', 'ID'],
  ['my', 'MY'],
  ['ph', 'PH'],
  ['sg', 'SG'],
  ['th', 'TH'],
  ['vn', 'VN'],
  ['asean', 'ASEAN'],
  ['ahtn', 'ASEAN'],
];

function inferRegionsFromCommandKeys(commandKeys: string[], dataset: DatasetKey): string[] {
  const regions = new Set<string>();

  for (const key of commandKeys) {
    const tokens = key
      .toLowerCase()
      .split(':')
      .flatMap((part) => part.split('-'))
      .filter(Boolean);

    for (const token of tokens) {
      for (const [prefix, region] of REGION_PREFIX_MAP) {
        if (token.startsWith(prefix)) {
          regions.add(region);
        }
      }
    }
  }

  if (dataset === 'notices') {
    // Current HTTP notice routes are CN authority crawlers.
    regions.add('CN');
  }

  if (regions.size === 0) {
    regions.add('GLOBAL');
  }

  return [...regions].sort();
}

function pickCommandKeys(dataset: DatasetKey, allCommandKeys: string[]): string[] {
  switch (dataset) {
    case 'duties':
      return allCommandKeys.filter((key) => key.startsWith('import:duties:'));
    case 'vat':
      return allCommandKeys.filter((key) => key.startsWith('import:vat'));
    case 'de-minimis':
      return allCommandKeys.filter((key) => key.startsWith('import:de-minimis:'));
    case 'surcharges':
      return allCommandKeys.filter((key) => key.startsWith('import:surcharges:'));
    case 'hs-aliases':
      return allCommandKeys.filter((key) => key.startsWith('import:hs:'));
    case 'freight':
      return allCommandKeys.filter((key) => key === 'import:freight');
    case 'fx':
      return allCommandKeys.filter((key) => key === 'fx:refresh');
    case 'notices':
      return allCommandKeys.filter((key) => key.startsWith('crawl:notices'));
    default:
      return [];
  }
}

export function getMetaCapabilitiesDocument() {
  const commandKeys = Object.keys(commands);

  const datasets: Record<
    DatasetKey,
    {
      supportedRegions: string[];
      scheduled: boolean;
      freshnessThresholdHours: number | null;
    }
  > = {
    duties: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.duties,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.duties,
    },
    vat: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.vat,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.vat,
    },
    'de-minimis': {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET['de-minimis'],
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS['de-minimis'],
    },
    surcharges: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.surcharges,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.surcharges,
    },
    'hs-aliases': {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET['hs-aliases'],
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS['hs-aliases'],
    },
    freight: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.freight,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.freight,
    },
    fx: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.fx,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.fx,
    },
    notices: {
      supportedRegions: [],
      scheduled: SCHEDULED_BY_DATASET.notices,
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS.notices,
    },
  };

  (Object.keys(datasets) as DatasetKey[]).forEach((dataset) => {
    const keys = pickCommandKeys(dataset, commandKeys);
    datasets[dataset] = {
      supportedRegions: inferRegionsFromCommandKeys(keys, dataset),
      scheduled: SCHEDULED_BY_DATASET[dataset],
      freshnessThresholdHours: FRESHNESS_THRESHOLD_HOURS[dataset],
    };
  });

  return {
    apiVersion: process.env.npm_package_version ?? '0.0.0',
    buildSha: process.env.GIT_SHA ?? null,
    datasets,
  };
}

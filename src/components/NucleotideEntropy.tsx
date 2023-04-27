import React, { useState, useMemo } from 'react';
import { MutationProportionData } from '../data/MutationProportionDataset';
import Loader from './Loader';
import { useQuery } from '../helpers/query-hook';
import { MutationProportionEntry } from '../data/MutationProportionEntry';
import { LapisSelector } from '../data/LapisSelector';
import { PipeDividedOptionsButtons } from '../helpers/ui';
import { NamedCard } from './NamedCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  TooltipProps,
  LineChart,
  Line,
  Rectangle,
} from 'recharts';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import { SequenceType } from '../data/SequenceType';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Form } from 'react-bootstrap';
import { globalDateCache, UnifiedDay } from '../helpers/date-cache';
import { FixedDateRangeSelector } from '../data/DateRangeSelector';
import { DateRange } from '../data/DateRange';
import { decodeNucMutation } from '../helpers/nuc-mutation';
import { decodeAAMutation, sortListByAAMutation } from '../helpers/aa-mutation';
import jsonRefData from '../data/refData.json';
import { colors } from '../widgets/common';
import { mapLabelsToColors } from '../helpers/colors';
import chroma from 'chroma-js';
import Select, { CSSObjectWithLabel, StylesConfig } from 'react-select';
import { getTicks } from '../helpers/ticks';
import { formatDate } from '../widgets/VariantTimeDistributionLineChartInner';
import { PercentageInput } from './PercentageInput';

type Props = {
  selector: LapisSelector;
};

type PositionProportion = {
  position: string;
  mutation: string | undefined;
  original: string | undefined;
  proportion: number;
};

type PositionEntropy = {
  position: string;
  proportions: PositionProportion[];
  entropy: number;
};

type WeekEntropy = {
  week: DateRange;
  meanEntropy: number;
};

export type TransformedTime = {
  [x: string]: string | number | undefined;
  day: number | undefined;
}[];

type Data = {
  positionEntropy: PositionEntropy[];
  timeData: any;
  sequenceType: SequenceType;
  ticks: number[];
};

type Gene = {
  name: string;
  startPosition: number;
  endPosition: number;
  aaSeq: string;
};

export type GeneOption = {
  value: string;
  label: string;
  startPosition: number;
  endPosition: number;
  aaSeq: string;
  color: string;
};

const toolTipStyle = {
  backgroundColor: 'white',
  zIndex: 1,
};

const colorStyles: Partial<StylesConfig<any, true, any>> = {
  control: (styles: CSSObjectWithLabel) => ({ ...styles, backgroundColor: 'white' }),
  multiValue: (styles: CSSObjectWithLabel, { data }: { data: GeneOption }) => {
    const color = chroma(data.color);
    return {
      ...styles,
      backgroundColor: color.alpha(0.1).css(),
    };
  },
  multiValueLabel: (styles: CSSObjectWithLabel, { data }: { data: GeneOption }) => ({
    ...styles,
    color: data.color,
  }),
  multiValueRemove: (styles: CSSObjectWithLabel, { data }: { data: GeneOption }) => {
    return {
      ...styles,
      'color': data.color,
      ':hover': {
        backgroundColor: data.color,
        color: 'white',
        cursor: 'pointer',
      },
    };
  },
};

function assignColorsToGeneOptions<T extends { label: string }>(options: T[]): (T & { color: string })[] {
  const colors = mapLabelsToColors(options.map(o => o.label));
  return options.map((o, i) => ({
    ...o,
    color: colors[i],
  }));
}

const genes = jsonRefData.genes;
!genes.map(o => o.name).includes('All') &&
  genes.push({ name: 'All', startPosition: 0, endPosition: 29903, aaSeq: '' });

const options: GeneOption[] = assignColorsToGeneOptions(
  genes.map(g => {
    return {
      value: g.name,
      label: g.name,
      startPosition: g.startPosition,
      endPosition: g.endPosition,
      aaSeq: g.aaSeq,
      color: chroma.random().darken().hex(),
    };
  })
);

export const NucleotideEntropy = ({ selector }: Props) => {
  const [plotType, setPlotType] = useState<string>('time');
  const [includeDeletions, setIncludeDeletions] = useState<boolean>(false);
  const [empty, setEmpty] = useState<boolean>(false);
  const [sequenceType, setSequenceType] = useState<SequenceType>('nuc');
  const [threshold, setThreshold] = useState(0.00001);
  const [gene, setGene] = useState<string>('all');
  const [selectedGeneOptions, setSelectedGenes] = useState([
    {
      value: 'All',
      label: 'All',
      color: '#353B89',
    },
  ]);

  const handleDeletions = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeDeletions(event.target.checked);
  };

  const handleEmpty = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmpty(event.target.checked);
  };

  let selectedGenes = options.filter(g => selectedGeneOptions.map(o => o.value).includes(g.value));

  const data = useData(selector, sequenceType, selectedGenes, includeDeletions, empty);

  const onChange = (value: any, { action, removedValue }: any) => {
    switch (action) {
      case 'remove-value':
      case 'pop-value':
        if (removedValue.isFixed) {
          return;
        }
        break;
      case 'clear':
        value = [{ value: 'All', label: 'All', color: '#353B89' }];
        break;
    }
    setSelectedGenes(value);
  };

  const controls = (
    <div className='mb-4'>
      <div className='mb-2 flex'>
        <PipeDividedOptionsButtons
          options={[
            { label: 'Nucleotides', value: 'nuc' },
            { label: 'Amino acids', value: 'aa' },
          ]}
          selected={sequenceType}
          onSelect={setSequenceType}
        />
      </div>
      <FormGroup>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeDeletions}
              onChange={handleDeletions}
              inputProps={{ 'aria-label': 'controlled' }}
            />
          }
          label='Include deletions'
        />
      </FormGroup>
      <div className='mb-2 flex'>
        <PipeDividedOptionsButtons
          options={[
            { label: 'Entropy over time', value: 'time' },
            { label: 'Entropy per position', value: 'pos' },
          ]}
          selected={plotType}
          onSelect={setPlotType}
        />
      </div>
      {plotType === 'pos' && (
        <div className=' w-72 flex mb-2'>
          <div className='mr-2'>Gene:</div>
          <Form.Control
            as='select'
            value={gene}
            onChange={ev => setGene(ev.target.value)}
            className='flex-grow'
            size='sm'
          >
            <option value='all'>All</option>
            {jsonRefData.genes.slice(0, -1).map(g => (
              <option value={g.name} key={g?.name}>
                {g.name}
              </option>
            ))}
          </Form.Control>
        </div>
      )}
      {plotType === 'time' && (
        <div className='flex mb-2'>
          <div className='mr-2'>Genes:</div>
          <Select
            closeMenuOnSelect={false}
            placeholder='Select genes...'
            isMulti
            options={options}
            styles={colorStyles}
            onChange={onChange}
            value={selectedGeneOptions}
          />
        </div>
      )}
      {plotType === 'pos' && (
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox checked={empty} onChange={handleEmpty} inputProps={{ 'aria-label': 'controlled' }} />
            }
            label='Include positions with zero entropy'
          />
        </FormGroup>
      )}
      {plotType === 'pos' && (
        <div className='flex mb-2'>
          <div className='mr-2'>Entropy display threshold: </div>
          <PercentageInput ratio={threshold} setRatio={setThreshold} className='mr-2' />
        </div>
      )}
      {empty && plotType === 'pos' && (
        <div>
          <p>
            Setting the entropy display threshold to 0 may lead to slower performance and too many positions
            to resolve at once in the plot. Zooming in via the brush control or gene selector displays the
            bars again.
          </p>
        </div>
      )}
    </div>
  );

  let geneRange: Gene | undefined = jsonRefData.genes.find(g => g.name === gene);

  let plotArea;
  if (!data) {
    plotArea = <Loader />;
  } else {
    plotArea = (
      <Plot
        threshold={threshold}
        plotData={data}
        plotType={plotType}
        selectedGenes={selectedGenes}
        ticks={data.ticks}
        geneRange={geneRange}
      />
    );
  }

  return (
    <>
      <NamedCard title='Nucleotide Entropy'>
        {controls}
        {plotArea}
      </NamedCard>
    </>
  );
};

const useData = (
  selector: LapisSelector,
  sequenceType: SequenceType,
  selectedGenes: GeneOption[],
  deletions: boolean,
  empty: boolean
): Data | undefined => {
  //fetch the proportions per position over the whole date range
  const mutationProportionEntriesQuery = useQuery(
    async signal => {
      return {
        sequenceType: sequenceType,
        result: await Promise.all([MutationProportionData.fromApi(selector, sequenceType, signal)]).then(
          async ([data]) => {
            const proportions: MutationProportionEntry[] = data.payload.map(m => m);
            return {
              proportions,
            };
          }
        ),
      };
    },
    [selector, sequenceType]
  );

  //fetch the proportions per position in weekly segments
  const weeklyMutationProportionQuery = useQuery(
    async signal => {
      //calculate weeks
      const dayArray: UnifiedDay[] = [
        selector.dateRange?.getDateRange().dateFrom!,
        selector.dateRange?.getDateRange().dateTo!,
      ];
      const dayRange = globalDateCache.rangeFromDays(dayArray)!;
      const weeks = globalDateCache.weeksFromRange({ min: dayRange.min.isoWeek, max: dayRange.max.isoWeek });
      const weekDateRanges = new Array<DateRange>();
      for (let i = 0; i < weeks.length; i++) {
        let dateRange: DateRange = { dateFrom: weeks[i].firstDay, dateTo: weeks[i].firstDay };
        weekDateRanges[i] = dateRange;
      }

      const weekSelectors: LapisSelector[] = weekDateRanges.map(w => ({
        ...selector,
        dateRange: new FixedDateRangeSelector(w),
      }));

      return Promise.all(
        weekSelectors.map((w, i) =>
          MutationProportionData.fromApi(w, sequenceType, signal).then(data => {
            const proportions: MutationProportionEntry[] = data.payload.map(m => m);
            let date = weekDateRanges[i];
            return {
              proportions,
              date,
            };
          })
        )
      );
    },
    [selector, sequenceType]
  );

  const data = useMemo(() => {
    if (!mutationProportionEntriesQuery.data || !weeklyMutationProportionQuery.data) {
      return undefined;
    }
    const sequenceType = mutationProportionEntriesQuery.data?.sequenceType;
    if (!sequenceType) {
      return undefined;
    }
    if (!selectedGenes) {
      return undefined;
    }
    //calculate ticks for entropy-over-time plot
    const dates = weeklyMutationProportionQuery.data.map(p => {
      return { date: p.date.dateFrom?.dayjs.toDate()! };
    });
    const ticks = getTicks(dates);

    //transform data for entropy-per-position plot
    const positionEntropy = calculateEntropy(
      mutationProportionEntriesQuery.data.result.proportions,
      sequenceType,
      deletions,
      empty
    );
    const sortedEntropy =
      sequenceType === 'aa' ? sortListByAAMutation(positionEntropy, m => m.position) : positionEntropy;

    //transform data for entropy-over-time plot
    const weekEntropies: TransformedTime[] = [];
    selectedGenes.forEach(selectedGene => {
      const timeData = weeklyMeanEntropy(
        weeklyMutationProportionQuery.data,
        sequenceType,
        selectedGene,
        deletions
      )
        .slice(0, -1)
        .map(({ week, meanEntropy }) => {
          return { day: week.dateFrom?.dayjs.toDate().getTime(), [selectedGene.value]: meanEntropy };
        });
      weekEntropies.push(timeData);
    });
    const timeArr: any = [];
    const timeMap = new Map();
    weekEntropies.forEach(w => {
      w.forEach(obj => {
        if (timeMap.has(obj.day)) {
          timeMap.set(obj.day, { ...timeMap.get(obj.day), ...obj });
        } else {
          timeMap.set(obj.day, { ...obj });
        }
      });
    });
    timeMap.forEach(obj => timeArr.push(obj));

    return { positionEntropy: sortedEntropy, timeData: timeArr, sequenceType: sequenceType, ticks: ticks };
  }, [mutationProportionEntriesQuery, weeklyMutationProportionQuery, selectedGenes, deletions]);

  return data;
};

type PlotProps = {
  threshold: number;
  plotData: Data;
  plotType: string;
  selectedGenes: GeneOption[];
  ticks: number[];
  geneRange: Gene | undefined;
};

const Plot = ({ threshold, plotData, plotType, selectedGenes, ticks, geneRange }: PlotProps) => {
  if (plotType === 'pos') {
    let filteredEntropy = plotData.positionEntropy.filter(p => p.entropy >= threshold);
    let startIndex = getBrushIndex(geneRange, filteredEntropy, plotData.sequenceType).startIndex;
    let stopIndex = getBrushIndex(geneRange, filteredEntropy, plotData.sequenceType).stopIndex;
    return (
      <>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            key={(startIndex || 0) + (stopIndex || 0)} //This fixes a weird bug where the plot doesn't redraw when the brush indexes are changed
            width={500}
            height={500}
            data={filteredEntropy}
            barCategoryGap={0}
            barGap={0}
            margin={{
              top: 30,
              right: 20,
              left: 20,
              bottom: 5,
            }}
          >
            <XAxis dataKey='position' tickFormatter={formatXAxis} />
            <YAxis ticks={[0, 0.5, 1]} />
            <Tooltip
              content={<CustomTooltip />}
              allowEscapeViewBox={{ y: true }}
              wrapperStyle={toolTipStyle}
            />
            <Legend />
            <Bar shape={CustomBar} dataKey='entropy' legendType='none'></Bar>
            <Brush
              dataKey='name'
              height={10}
              stroke={colors.active}
              travellerWidth={10}
              gap={10}
              startIndex={startIndex}
              endIndex={stopIndex}
            />
          </BarChart>
        </ResponsiveContainer>
      </>
    );
  } else {
    return (
      <>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart
            width={500}
            height={500}
            data={plotData.timeData}
            margin={{
              top: 30,
              right: 20,
              left: 20,
              bottom: 5,
            }}
          >
            <XAxis
              dataKey='day'
              scale='time'
              type='number'
              tickFormatter={formatDate}
              domain={[(dataMin: any) => dataMin, () => plotData.timeData[plotData.timeData.length - 1]?.day]}
              ticks={plotData.ticks}
              xAxisId='day'
            />
            <YAxis />
            <Tooltip
              formatter={(value: string) => Number(value).toFixed(6)}
              labelFormatter={label => {
                return 'Week starting on: ' + formatDate(label);
              }}
            />
            <Legend />
            {selectedGenes.map((gene: GeneOption) => (
              <Line
                xAxisId='day'
                type='monotone'
                dataKey={gene.value}
                strokeWidth={3}
                dot={false}
                stroke={gene.color}
                isAnimationActive={false}
                key={gene.value}
                legendType='none'
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </>
    );
  }
};

const calculateEntropy = (
  muts: MutationProportionEntry[] | undefined,
  sequenceType: SequenceType,
  deletions: boolean,
  empty: boolean
): PositionEntropy[] => {
  let positionProps = new Array<PositionProportion>();

  //prefill Arrays for every position
  if (sequenceType === 'nuc' && empty) {
    positionProps = Array.apply(null, Array<PositionProportion>(29903)).map(function (x, i) {
      let p: PositionProportion = {
        position: i.toString(),
        mutation: undefined,
        original: jsonRefData.nucSeq.substring(i, i + 1),
        proportion: 0,
      };
      return p;
    });
  } else if (sequenceType === 'aa' && empty) {
    jsonRefData.genes.forEach(g =>
      g.aaSeq.split('').forEach(function (aa, i) {
        let p: PositionProportion = {
          position: g.name + ':' + aa + (i + 1).toString(),
          mutation: undefined,
          original: aa,
          proportion: 0,
        };
        positionProps.push(p);
      })
    );
  }

  //map mutation proportions to positions
  muts?.forEach(mut => {
    if (sequenceType === 'aa') {
      let decoded = decodeAAMutation(mut.mutation);
      if (decoded.mutatedBase !== '-' || (decoded.mutatedBase == '-' && deletions)) {
        let pp: PositionProportion = {
          position: decoded.gene + ':' + decoded.originalBase + decoded.position,
          mutation: decoded.mutatedBase,
          original: decoded.originalBase,
          proportion: mut.proportion,
        };
        positionProps.push(pp);
      }
    } else {
      let decoded = decodeNucMutation(mut.mutation);
      if (decoded.mutatedBase !== '-' || (decoded.mutatedBase == '-' && deletions)) {
        let pp: PositionProportion = {
          position: decoded.position.toString(),
          mutation: decoded.mutatedBase,
          original: decoded.originalBase,
          proportion: mut.proportion,
        };
        positionProps.push(pp);
      }
    }
  });

  //group proportions by position
  const positionGroups = Object.entries(groupBy(positionProps, p => p.position)).map(p => {
    return {
      position: p[0],
      original: p[1][0].original,
      proportions: p[1],
      entropy: 0,
    };
  });

  //calculate remaining original proportion for each position
  positionGroups.forEach(pos => {
    const remainder = 1 - pos.proportions.map(p => p.proportion).reduce((x, a) => x + a, 0);
    if (remainder !== 0) {
      pos.proportions.push({
        position: pos.position,
        mutation: pos.original + ' (ref)',
        original: pos.original,
        proportion: remainder,
      });
    }
    pos.proportions = pos.proportions.filter(p => p.proportion > 0);
  });

  //convert proportion to entropy
  positionGroups.map(p => {
    let sum = 0;
    p.proportions.forEach(pp => (sum += pp.proportion * Math.log(pp.proportion)));
    p.entropy = -sum;
  });

  return positionGroups;
};

const meanEntropy = (posEntropy: PositionEntropy[], sequenceType: SequenceType, gene: GeneOption): number => {
  const filteredPos =
    sequenceType === 'nuc'
      ? posEntropy.filter(
          g => gene.startPosition <= parseInt(g.position) && parseInt(g.position) <= gene.endPosition
        )
      : gene.value === 'All'
      ? posEntropy
      : posEntropy.filter(g => g.position.includes(gene.value));
  const sum = filteredPos.map(f => f.entropy).reduce((x, a) => x + a, 0);
  const count =
    sequenceType === 'nuc'
      ? gene.endPosition - gene.startPosition
      : (gene.value === 'All'
          ? jsonRefData.genes
          : jsonRefData.genes.filter(g => g.name.includes(gene.value))
        )
          .map(g => g.aaSeq.length)
          .reduce((x, a) => x + a, 0);
  return sum / count;
};

export const weeklyMeanEntropy = (
  weeks: { proportions: MutationProportionEntry[]; date: DateRange }[] | undefined,
  sequenceType: SequenceType,
  selectedGene: GeneOption,
  deletions: boolean
): WeekEntropy[] => {
  let means = new Array<WeekEntropy>();
  weeks?.forEach(w =>
    means.push({
      week: w.date,
      meanEntropy: meanEntropy(
        calculateEntropy(w.proportions, sequenceType, deletions, false),
        sequenceType,
        selectedGene
      ),
    })
  );

  return means;
};

const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>);

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active) {
    return (
      <div className='recharts-tooltip-wrapper recharts-tooltip-wrapper-left recharts-tooltip-wrapper-top custom-tooltip'>
        <p style={{ paddingLeft: 10 }} className='label'>
          Position: <b>{label}</b>
        </p>
        <p style={{ paddingLeft: 10 }}>
          Entropy: <b>{Number(payload?.[0].value).toFixed(5)}</b>
        </p>

        <p style={{ paddingLeft: 10, paddingRight: 10 }}>Proportions:</p>
        {payload?.[0].payload?.proportions.map((pld: any) => (
          <div style={{ display: 'inline-block', paddingLeft: 10, paddingRight: 10, paddingBottom: 10 }}>
            <div>
              <b>{pld.mutation}</b> : {pld.proportion.toFixed(5)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const getBrushIndex = (
  gene: Gene | undefined,
  plotData: PositionEntropy[],
  sequenceType: SequenceType
): { startIndex: number; stopIndex: number } => {
  let startIndex;
  let stopIndex;
  if (sequenceType === 'aa') {
    let names = plotData.map(p => decodeAAMutation(p.position).gene);
    startIndex = gene?.name !== 'All' && gene?.name !== undefined ? names.indexOf(gene.name) : 0;
    stopIndex =
      gene?.name !== 'All' && gene?.name !== undefined ? names.lastIndexOf(gene.name) : plotData.length - 1;
  } else {
    startIndex =
      gene?.name !== 'All' && gene?.startPosition !== undefined
        ? plotData.findIndex(p => parseInt(p.position) > gene.startPosition)
        : 0;
    stopIndex =
      gene?.name !== 'All' && gene?.endPosition !== undefined
        ? plotData.findIndex(p => parseInt(p.position) > gene.endPosition) - 1
        : plotData.length - 1;
  }
  return { startIndex: startIndex, stopIndex: stopIndex };
};

function formatXAxis(value: any) {
  return value.toString().includes(':') ? decodeAAMutation(value).position : value;
}

const CustomBar = (props: PositionProportion) => {
  return (
    <Rectangle
      {...props}
      fill={
        props.position.includes(':')
          ? options.find(o => decodeAAMutation(props.position).gene.includes(o.label))?.color
          : options.find(
              o => o.startPosition <= parseInt(props.position) && parseInt(props.position) < o.endPosition
            )?.color
      }
    />
  );
};

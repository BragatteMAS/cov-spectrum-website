import React from 'react';
import { AsyncState } from 'react-async';
import { KnownVariantsList } from '../components/KnownVariantsList/KnownVariantsList';
import { MutationLookup } from '../components/MutationLookup';
import { NamedSection } from '../components/NamedSection';
import { NewVariantTable } from '../components/NewVariantTable';
import { ScrollableTabs } from '../components/ScrollableTabs';
import { VariantSelector } from '../helpers/sample-selector';
import { SampleSetWithSelector } from '../helpers/sample-set';
import { DateRange, SamplingStrategy } from '../services/api';
import { Country } from '../services/api-types';
import { isRegion } from '../services/api';
import { SequencingIntensityPlotWidget } from '../widgets/SequencingIntensityPlot';
import styled from 'styled-components';
import { ExternalLink } from '../components/ExternalLink';

interface Props {
  country: Country;
  samplingStrategy: SamplingStrategy;
  dateRange: DateRange;
  onVariantSelect: (selection: VariantSelector) => void;
  selection: VariantSelector | undefined;
  wholeSampleSetState: AsyncState<SampleSetWithSelector>;
}

const Footer = styled.footer`
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px solid darkgray;
  font-size: small;
`;

export const ExplorePage = ({
  country,
  samplingStrategy,
  dateRange,
  onVariantSelect,
  selection,
  wholeSampleSetState,
}: Props) => {
  return (
    <ScrollableTabs
      tabs={[
        {
          key: 'explore',
          title: 'Explore',
          content: (
            <>
              <NamedSection title=''>
                <SequencingIntensityPlotWidget.ShareableComponent
                  title='Sequencing Intensity'
                  country={country}
                  height={300}
                  widgetLayout={NamedSection}
                />
              </NamedSection>
              <NamedSection title='Known variants'>
                <KnownVariantsList
                  country={country}
                  samplingStrategy={samplingStrategy}
                  onVariantSelect={onVariantSelect}
                  selection={selection}
                  wholeSampleSetState={wholeSampleSetState}
                />
              </NamedSection>
              <NamedSection title='Search by mutations'>
                <MutationLookup onVariantSelect={onVariantSelect} />
              </NamedSection>
              {!isRegion(country) && (
                <NamedSection title='Interesting mutations'>
                  <NewVariantTable
                    country={country}
                    onVariantSelect={variant => onVariantSelect({ variant, matchPercentage: 1 })}
                  />
                </NamedSection>
              )}
              <Footer>
                Data obtained from GISAID that is used in this Web Application remain subject to GISAID’s{' '}
                <ExternalLink url='http://gisaid.org/daa'>Terms and Conditions</ExternalLink>.
              </Footer>
            </>
          ),
        },
      ]}
    />
  );
};

import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Interactive CLI REPL',
    image: require('@site/static/img/patb-cli-image-1-3.png').default,
    description: (
      <>
        Start a direct conversation with the remote "Pinky and the Brain" agent
        right from your terminal, with real-time progress logged to <code>stderr</code>.
      </>
    ),
  },
  {
    title: 'Zed ACP Bridge',
    image: require('@site/static/img/patb-cli-image-2-3.png').default,
    description: (
      <>
        Run <code>patb-cli</code> as a JSON-RPC 2.0 bridge server so the Zed Editor
        can talk to the remote agent as a custom AI assistant.
      </>
    ),
  },
  {
    title: 'Real-Time Streaming',
    image: require('@site/static/img/patb-cli-image-3-3.png').default,
    description: (
      <>
        Progress notifications and response chunks stream back as the remote agent
        works, in both the interactive REPL and the ACP bridge.
      </>
    ),
  },
];

function Feature({title, image, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img src={image} className={styles.featureImage} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

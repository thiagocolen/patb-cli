import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Pinky and the Brain CLI',
  tagline: 'Interactive CLI and Zed ACP Bridge for Pinky and the Brain remote service',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://thiagocolen.github.io',
  // Set the /<projectName>/ path for GitHub pages
  baseUrl: '/patb-cli/',

  // GitHub pages deployment config.
  organizationName: 'thiagocolen', // Usually your GitHub org/user name.
  projectName: 'patb-cli', // Usually your repo name.
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Both are required, and neither is useful alone: the flag tells MDX to hand
  // ```mermaid blocks to a diagram renderer, and the theme is what supplies
  // one. Without them Docusaurus treats the block as ordinary code and prints
  // the graph definition as text — which is what this site did until now.
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/thiagocolen/patb-cli/edit/master/docs/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: 'all',
            copyright: `Copyright © ${new Date().getFullYear()} thiagocolen.`,
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'patb-cli',
      // The same badge the agent's own docs carry, byte for byte. This CLI is a
      // client of that service, not a separate product, so it wears the same
      // mark; only the hero's warm ramp tells the two sites apart.
      logo: {
        alt: 'Pinky and the Brain Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/thiagocolen/patb-cli',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/thiagocolen/patb-cli/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} thiagocolen. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

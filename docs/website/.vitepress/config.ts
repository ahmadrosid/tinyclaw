import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'TinyClaw',
    description: 'Deploy your own AI Agent platform as easily as spinning up WordPress.',
    base: '/tinyclaw/',
    head: [['link', { rel: 'icon', href: '/tinyclaw/favicon.ico' }]],
    themeConfig: {
      nav: [
        { text: 'Guide', link: '/getting-started' },
        {
          text: 'GitHub',
          link: 'https://github.com/ahmadrosid/tinyclaw',
        },
      ],
      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
          ],
        },
        {
          text: 'Concepts',
          items: [
            { text: 'Overview', link: '/overview' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Multi-tenancy', link: '/multi-tenancy' },
            { text: 'Builtin tools', link: '/builtin-tools' },
          ],
        },
        {
          text: 'Contributing',
          items: [{ text: 'Development', link: '/development' }],
        },
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/ahmadrosid/tinyclaw' },
      ],
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © TinyClaw contributors',
      },
    },
  }),
)

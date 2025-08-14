import { Route } from '@/types';
import { handler } from './handler';

export const route: Route = {
    path: '/:category?',
    name: 'HRT Tech Blog',
    maintainers: ['BigJules'],
    handler,
    example: '/hrt/algo',
    parameters: {
        category: {
            description: 'Category',
            optional: true,
            default: 'all',
            options: [
                { value: 'algo', label: 'Algorithm' },
                { value: 'engineers', label: 'Engineering' },
                { value: 'interns', label: 'Intern Spotlight' },
                { value: 'more', label: 'Hardware, Systems & More' },
            ],
        },
    },
    description: `
HRT (Hudson River Trading) is a quantitative trading firm that uses advanced algorithms and technology to trade across global financial markets.

The HRT Tech Blog is divided into the following sections:

| Section               | Route        |
| --------------------- | ------------ |
| Algorithm             | /hrt/algo    |
| Engineering           | /hrt/engineers|
| Intern Spotlight      | /hrt/interns |
| Hardware, Systems & More | /hrt/more    |

If you don't specify a section, you will get all articles.
    `,
    categories: ['programming'],
};

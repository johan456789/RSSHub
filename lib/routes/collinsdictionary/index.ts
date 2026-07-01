import type { Data, Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const ROOT_URL = 'https://blog.collinsdictionary.com';
const CDN_HOST = 's28434.pcdn.co';
const CATEGORY_ID = 230;

type WordpressPost = {
    id: number;
    date: string;
    date_gmt?: string;
    link: string;
    title?: { rendered?: string };
    excerpt?: { rendered?: string };
    content?: { rendered?: string };
    _embedded?: {
        author?: Array<{ name?: string }>;
        'wp:term'?: Array<Array<{ name?: string }>>;
    };
};

export const route: Route = {
    path: '/blog/learning-spanish',
    categories: ['blog'],
    example: '/collinsdictionary/blog/learning-spanish',
    parameters: {},
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['blog.collinsdictionary.com/language-learners/learning-spanish/'],
            target: '/blog/learning-spanish',
        },
    ],
    name: 'Learning Spanish',
    maintainers: ['johan456789'],
    handler,
    description: 'Learning Spanish - Collins Dictionary Language Blog',
};

async function handler(): Promise<Data> {
    const apiUrl = `${ROOT_URL}/wp-json/wp/v2/posts?categories=${CATEGORY_ID}&per_page=20&_embed=author,wp:term`;
    const data = await ofetch<WordpressPost[]>(apiUrl);

    const items = data.map((post) => ({
        title: post.title?.rendered,
        description: (post.content?.rendered ?? post.excerpt?.rendered ?? '').replaceAll(CDN_HOST, () => ROOT_URL),
        link: post.link,
        pubDate: parseDate(post.date_gmt ?? post.date),
        author: post._embedded?.author?.[0]?.name,
        category: Array.isArray(post._embedded?.['wp:term'])
            ? post._embedded['wp:term']
                  .flat()
                  .map((term: any) => term?.name)
                  .filter(Boolean)
            : undefined,
    }));

    return {
        title: 'Learning Spanish - Collins Dictionary Language Blog',
        link: `${ROOT_URL}/language-learners/learning-spanish/`,
        language: 'en-gb',
        item: items,
    } as Data;
}

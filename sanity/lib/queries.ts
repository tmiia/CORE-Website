import { groq } from "next-sanity";

export const pageQuery = groq`
  *[_type == "page" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    seo {
      metaTitle,
      metaDescription,
    },
  }
`;

export const allPagesQuery = groq`
  *[_type == "page"] {
    _id,
    title,
    slug,
  }
`;

export const allStoriesQuery = groq`
  *[_type == "story"] | order(_createdAt asc) {
    _id,
    title,
    origin,
    birthYear,
    description,
    slug,
    thumbnail,
  }
`;

export const projectTopicsQuery = groq`
  *[_type == "projectTopic" && defined(title) && defined(body)] | order(order asc, _createdAt asc) {
    _id,
    title,
    subtitle,
    body,
  }
`;

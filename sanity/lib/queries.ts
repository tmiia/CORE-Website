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
    "path": coalesce(slug.current, _id),
    thumbnail,
  }
`;

export const allStorySlugsQuery = groq`
  *[_type == "story"] {
    slug,
    "path": coalesce(slug.current, _id),
  }
`;

export const storyBySlugQuery = groq`
  *[_type == "story" && (slug.current == $slug || _id == $slug)][0] {
    _id,
    title,
    origin,
    birthYear,
    description,
    slug,
    "path": coalesce(slug.current, _id),
    thumbnail,
    content,
    keyConcepts[] {
      _key,
      title,
      description,
    },
    archiveImages[] {
      _key,
      image,
      caption,
      source,
    },
    resources[] {
      _key,
      title,
      url,
      description,
      type,
    },
    genre-> {
      _id,
      name,
      origin,
      birth,
      description,
      history,
      images,
    },
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

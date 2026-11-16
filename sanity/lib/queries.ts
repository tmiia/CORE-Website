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
    "genreName": genre->name,
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
    keyConcepts[] {
      _key,
      title,
      description,
    },
    archiveImages[] {
      _key,
      image,
      "dimensions": image.asset->metadata.dimensions { width, height },
      "videoUrl": video.asset->url,
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

// Published document only (its fixed id, without "drafts."): with the token,
// the default perspective would return drafts too.
export const projectPageQuery = groq`
  *[_id == $id][0] {
    kicker,
    title,
    lede,
    chapters[] {
      label,
      heading,
      body,
      images[] {
        caption,
        "src": asset->url,
        "width": asset->metadata.dimensions.width,
        "height": asset->metadata.dimensions.height,
      },
    },
    installation { label, heading, body, rows[] { label, value } },
    exhibition { start, end, venue, city, festival, festivalUrl, hours, entry, announcement },
  }
`;

import { defineType, defineField } from "sanity";

export const storySchema = defineType({
  name: "story",
  title: "Story",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "genre",
      title: "Genre",
      type: "reference",
      to: [{ type: "genre" }],
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "string",
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      of: [{ type: "block" }],
      // The TRANSMISSION section (the V1 riddle text) is gone from the site.
      deprecated: { reason: "N'est plus affiché sur le site (section TRANSMISSION retirée)." },
      hidden: ({ value }) => !value,
    }),
    defineField({
      name: "keyConcepts",
      title: "Notions clés",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Titre",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 3,
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "description",
            },
          },
        },
      ],
    }),
    defineField({
      // Field name kept (existing documents): items are images or videos now.
      name: "archiveImages",
      title: "Archives (images ou vidéos)",
      description:
        "Posées les unes sur les autres dans la section Contexte, dans cet ordre. Les images et extraits utilisés dans le clip ont leur place ici.",
      type: "array",
      of: [
        {
          type: "object",
          // One of the two: an image, or a short video (muted loop).
          validation: (Rule) =>
            Rule.custom((value: { image?: unknown; video?: unknown } | undefined) =>
              value?.image || value?.video ? true : "Ajoute une image ou une vidéo",
            ),
          fields: [
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
            }),
            defineField({
              name: "video",
              title: "Vidéo",
              description:
                "Extrait court, sans son (joué en boucle). MP4 H.264, 720p max, quelques Mo : il est chargé sur téléphone.",
              type: "file",
              options: { accept: "video/mp4,video/webm" },
            }),
            defineField({
              name: "caption",
              title: "Légende",
              type: "string",
            }),
            defineField({
              name: "source",
              title: "Source",
              type: "string",
            }),
          ],
          preview: {
            select: {
              title: "caption",
              subtitle: "source",
              media: "image",
              video: "video.asset._ref",
            },
            prepare({ title, subtitle, media, video }) {
              return {
                title: title || (video && !media ? "Vidéo d'archive" : "Image d'archive"),
                subtitle,
                media,
              };
            },
          },
        },
      ],
    }),
    defineField({
      name: "resources",
      title: "Ressources",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Titre",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "url",
              title: "URL",
              type: "url",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "description",
              title: "Description",
              type: "text",
              rows: 2,
            }),
            defineField({
              name: "type",
              title: "Type",
              type: "string",
              options: {
                list: [
                  { title: "Article", value: "article" },
                  { title: "Livre", value: "book" },
                  { title: "Vidéo", value: "video" },
                  { title: "Audio", value: "audio" },
                  { title: "Archive", value: "archive" },
                  { title: "Autre", value: "other" },
                ],
              },
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "url",
            },
          },
        },
      ],
    }),
    defineField({
      name: "thumbnail",
      title: "Thumbnail",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "origin",
      title: "Origine",
      type: "string",
    }),
    defineField({
      name: "birthYear",
      title: "Année de naissance",
      type: "number",
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "genre.name",
      media: "thumbnail",
    },
  },
});

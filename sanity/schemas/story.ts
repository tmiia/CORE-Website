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
      name: "archiveImages",
      title: "Images d'archives",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              validation: (Rule) => Rule.required(),
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
            },
            prepare({ title, subtitle, media }) {
              return {
                title: title || "Image d'archive",
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

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

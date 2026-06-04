import { defineType, defineField } from "sanity";

export const genreSchema = defineType({
  name: "genre",
  title: "Genre",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "origin",
      title: "Origin",
      type: "string",
    }),
    defineField({
      name: "birth",
      title: "Birth Date",
      type: "date",
      options: {
        dateFormat: "DD MMMM YYYY",
      },
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "string",
    }),
    defineField({
      name: "history",
      title: "History",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "origin",
    },
  },
});

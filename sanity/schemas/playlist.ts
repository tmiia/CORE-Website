import { defineType, defineField } from "sanity";

export const playlistSchema = defineType({
  name: "playlist",
  title: "Playlist",
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
      name: "songs",
      title: "Songs",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "artists",
              title: "Artists",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "artists",
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "genre.name",
    },
  },
});

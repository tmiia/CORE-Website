import { defineArrayMember, defineType, defineField } from "sanity";

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
      description:
        "Le texte de la section Contexte (il s'écrit au scroll). Pour citer une source : sélectionner le passage, « Source », coller son URL. Si cette URL est dans les ressources de la story, le renvoi prend son numéro ; sinon la source est ajoutée à la liste.",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          marks: {
            annotations: [
              // Sanity's default link, kept as is (existing data).
              {
                name: "link",
                type: "object",
                title: "Lien",
                fields: [{ name: "href", type: "url", title: "URL" }],
              },
              {
                name: "sourceRef",
                type: "object",
                title: "Source",
                fields: [
                  defineField({
                    name: "url",
                    title: "URL de la source",
                    type: "url",
                    validation: (Rule) => Rule.required(),
                  }),
                  defineField({
                    name: "title",
                    title: "Titre",
                    description: "Seulement si la source n'est pas déjà dans les ressources de la story.",
                    type: "string",
                  }),
                ],
              },
            ],
          },
        }),
      ],
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

import { defineArrayMember, defineField, defineType } from "sanity";

const required = <R extends { required(): R }>(rule: R) => rule.required();

/** Plain paragraphs: one block per paragraph, no styles, lists or marks (the
 * page shows plain text). */
const paragraphs = (description: string) =>
  defineField({
    name: "body",
    title: "Texte",
    description,
    type: "array",
    of: [
      defineArrayMember({
        type: "block",
        styles: [{ title: "Paragraphe", value: "normal" }],
        lists: [],
        marks: { decorators: [], annotations: [] },
      }),
    ],
    validation: (rule) => rule.required().min(1),
  });

/** A chapter's title bar and key line. */
const chapterHead = [
  defineField({
    name: "label",
    title: "Titre de section",
    description: "La barre de titre, ex. « D'OÙ L'ON VIENT ». Le numéro (01, 02…) est ajouté tout seul.",
    type: "string",
    validation: required,
  }),
  defineField({
    name: "heading",
    title: "Phrase clé",
    description: "La grande phrase sous le titre, décodée au scroll.",
    type: "text",
    rows: 2,
    validation: required,
  }),
];

export const projectPageSchema = defineType({
  name: "projectPage",
  title: "Page projet",
  type: "document",
  groups: [
    { name: "hero", title: "Haut de page", default: true },
    { name: "chapters", title: "Chapitres" },
    { name: "installation", title: "L'installation" },
    { name: "exhibition", title: "Diffusion" },
  ],
  fields: [
    defineField({
      name: "kicker",
      title: "Surtitre",
      description: "Le bandeau au-dessus du titre.",
      type: "string",
      group: "hero",
      validation: required,
    }),
    defineField({ name: "title", title: "Titre", type: "string", group: "hero", validation: required }),
    defineField({
      name: "lede",
      title: "Accroche",
      description: "La phrase sous le titre. Elle sert aussi de description pour les moteurs de recherche.",
      type: "text",
      rows: 2,
      group: "hero",
      validation: required,
    }),

    defineField({
      name: "chapters",
      title: "Chapitres",
      description: "Les sections de texte, dans l'ordre. La dernière glisse sous la fiche de l'installation.",
      type: "array",
      group: "chapters",
      of: [
        defineArrayMember({
          name: "projectChapter",
          title: "Chapitre",
          type: "object",
          fields: [
            ...chapterHead,
            paragraphs("Un paragraphe par bloc (Entrée pour en commencer un nouveau)."),
            defineField({
              name: "images",
              title: "Photos",
              description: "Optionnel : des photos de l'installation, posées comme des tirages sous le texte.",
              type: "array",
              of: [
                defineArrayMember({
                  type: "image",
                  options: { hotspot: true },
                  fields: [defineField({ name: "caption", title: "Légende", type: "string" })],
                }),
              ],
            }),
          ],
          preview: { select: { title: "label", subtitle: "heading" } },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),

    defineField({
      name: "installation",
      title: "L'installation",
      description: "La fiche (cartel) qui glisse par-dessus le dernier chapitre.",
      type: "object",
      group: "installation",
      fields: [
        ...chapterHead,
        paragraphs("Un paragraphe par bloc."),
        defineField({
          name: "rows",
          title: "Fiche",
          description: "Libellé à gauche, valeur à droite. Séparer plusieurs valeurs par « · » : une par ligne.",
          type: "array",
          of: [
            defineArrayMember({
              name: "row",
              type: "object",
              fields: [
                defineField({ name: "label", title: "Libellé", type: "string", validation: required }),
                defineField({ name: "value", title: "Valeur", type: "string", validation: required }),
              ],
              preview: { select: { title: "label", subtitle: "value" } },
            }),
          ],
        }),
      ],
      validation: required,
    }),

    defineField({
      name: "exhibition",
      title: "Diffusion",
      description:
        "L'exposition. Le titre de section suit les dates : PROCHAINE DIFFUSION avant, EN DIRECT pendant, DIFFUSÉ après.",
      type: "object",
      group: "exhibition",
      fields: [
        defineField({ name: "start", title: "Premier jour", type: "date", validation: required }),
        defineField({
          name: "end",
          title: "Dernier jour",
          type: "date",
          validation: (rule) =>
            rule.required().custom((end, context) => {
              const start = (context.parent as { start?: string } | undefined)?.start;
              return !end || !start || end >= start ? true : "Le dernier jour est avant le premier.";
            }),
        }),
        defineField({ name: "venue", title: "Lieu", type: "string", validation: required }),
        defineField({ name: "city", title: "Ville", type: "string", validation: required }),
        defineField({ name: "festival", title: "Festival", type: "string", validation: required }),
        defineField({ name: "festivalUrl", title: "Site du festival", type: "url" }),
        defineField({ name: "hours", title: "Horaires", type: "string", validation: required }),
        defineField({ name: "entry", title: "Entrée", type: "string", validation: required }),
        defineField({
          name: "announcement",
          title: "Phrase sous les dates",
          description: "Une version par moment : la page affiche la bonne selon la date.",
          type: "object",
          fields: [
            defineField({ name: "upcoming", title: "Avant", type: "text", rows: 2, validation: required }),
            defineField({ name: "live", title: "Pendant", type: "text", rows: 2, validation: required }),
            defineField({ name: "past", title: "Après", type: "text", rows: 2, validation: required }),
          ],
          validation: required,
        }),
      ],
      validation: required,
    }),
  ],
  preview: { prepare: () => ({ title: "Page projet" }) },
});

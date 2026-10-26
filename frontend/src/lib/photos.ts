/**
 * The site's own photos (public/photos), all from Wikimedia Commons under Creative Commons
 * licences that need the author, licence and source named; the /credits page shows them.
 * position is the CSS background-position that keeps the subject inside an oval.
 */
export interface Photo {
  src: string;
  position: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const PHOTOS = {
  dresses: {
    src: "/photos/dresses.jpg",
    position: "30% 20%",
    author: "judy dean",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    source: commons("Yet_another_Wedding_Dress_Shop_-_Flickr_-_judy_dean.jpg"),
  },
  bouquet: {
    src: "/photos/bouquet.jpg",
    position: "center",
    author: "böhringer friedrich",
    license: "CC BY-SA 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5",
    source: commons("Hochzeitsstrau%C3%9F_1.JPG"),
  },
  cars: {
    src: "/photos/cars.jpg",
    position: "88% 60%", // the front of the limousine, with the flowers on the bonnet
    author: "Garitzko",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: commons("Lincoln_Town_Car_limousine_wedding_car.jpg"),
  },
  "national-clothes": {
    src: "/photos/national-clothes.jpg",
    position: "center 30%",
    author: "Gulzar Nurlyyeva",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: commons("Traditional_dressed_turkmen_bride.jpg"),
  },
  tents: {
    src: "/photos/tents.jpg",
    position: "40% center",
    author: "Derek Bennett",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    source: commons("Wedding_Marquee_-_geograph.org.uk_-_5085750.jpg"),
  },
  "car-decorations": {
    src: "/photos/car-decorations.jpg",
    position: "55% 45%",
    author: "Matti Blume",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: commons("Wedding_car,_Kish_(P1090371).jpg"),
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/** A category's photo, shown next to its name on Home and Categories. */
export function categoryPhoto(slug: string): Photo | undefined {
  return (PHOTOS as Record<string, Photo>)[slug];
}

/** Inline style for a photo filling an element (background-size: cover comes from its class). */
export function photoStyle(photo: Photo | undefined) {
  return photo ? { "background-image": `url("${photo.src}")`, "background-position": photo.position } : undefined;
}

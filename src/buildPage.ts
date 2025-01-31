export async function constructHTML({
  texth1,
  texth2,
  textP,
  title,
}: ConstructImports) {
  const file = Bun.file("page.html");
  const text = await file.text();
  return text
    .replaceAll("{{texth1}}", texth1 ?? "")
    .replaceAll("{{texth2}}", texth2 ?? "")
    .replaceAll("{{textP}}", textP ?? "")
    .replaceAll("{{pageTitle}}", title ?? "");
}

export const capeNotFound = (wardrobe: string, c: any) => {
  return c.html(
    constructHTML({
      texth1: "Sorry!",
      texth2: "Cape not found",
      textP: wardrobe,
      title: "Cape not found",
    }),
    404,
  );
};

export const userNotFound = (wardrobe: string, c: any) => {
  return c.html(
    constructHTML({
      texth1: "Sorry!",
      texth2: "User not found",
      textP: wardrobe,
      title: "User not found",
    }),
    404,
  );
};

export const fileNotFound = (wardrobe: string, c: any) => {
  return c.html(
    constructHTML({
      texth1: "Sorry!",
      texth2: "File not found",
      textP: wardrobe,
      title: "File not found",
    }),
    404,
  );
};

export const genericError = (wardrobe: string, c: any) => {
  return c.html(
    constructHTML({
      texth1: "Sorry!",
      texth2: "An error occurred",
      textP: wardrobe,
      title: "An error occurred",
    }),
    500,
  );
};

type ConstructImports = {
  texth1: string | undefined;
  texth2: string | undefined;
  textP: string | undefined;
  title: string | undefined;
};

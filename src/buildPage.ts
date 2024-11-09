export async function constructHTML({texth1, texth2, textP, title}: ConstructImports) {
    const file = Bun.file('page.html')
    const text = await file.text();
    return (((text.replaceAll('{{texth1}}', texth1 ?? '')).replaceAll('{{texth2}}', texth2 ?? '')).replaceAll('{{textP}}', textP ?? '')).replaceAll('{{pageTitle}}', title ?? '');
}

type ConstructImports = {
    texth1: string | undefined;
    texth2:  string | undefined;
    textP:  string | undefined;
    title:   string | undefined;
}
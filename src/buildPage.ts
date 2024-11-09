export async function constructHTML(inputText: string, secondary: string = '') {
    const file = Bun.file('page.html')
    const text = await file.text();
    return (text.replaceAll('{{textPlaceholder}}', inputText)).replaceAll('{{textSecondary}}', secondary)
}
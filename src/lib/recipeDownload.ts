import { SupabaseRecipe, getLocalizedRecipe } from '@/types/recipe';
import jsPDF from 'jspdf';

type Language = 'en' | 'zh';

export function downloadRecipeAsCsv(recipe: SupabaseRecipe, language: Language) {
  const loc = getLocalizedRecipe(recipe, language);
  const name = loc.name || recipe.name;
  const ingredients = loc.ingredients || [];
  const instructions = loc.instructions || [];

  const rows: string[][] = [
    [language === 'zh' ? '食谱名称' : 'Recipe Name', name],
    [language === 'zh' ? '描述' : 'Description', loc.description || ''],
    [language === 'zh' ? '菜系' : 'Cuisine', recipe.cuisine || ''],
    [language === 'zh' ? '难度' : 'Difficulty', recipe.difficulty || ''],
    [language === 'zh' ? '准备时间(分钟)' : 'Prep Time (min)', String(recipe.prep_time || '')],
    [language === 'zh' ? '烹饪时间(分钟)' : 'Cook Time (min)', String(recipe.cook_time || '')],
    [language === 'zh' ? '卡路里' : 'Calories', String(recipe.calories || '')],
    [],
    [language === 'zh' ? '食材' : 'Ingredients', language === 'zh' ? '用量' : 'Amount'],
    ...ingredients.map(i => [i.name, i.amount]),
    [],
    [language === 'zh' ? '步骤' : 'Step', language === 'zh' ? '说明' : 'Instruction'],
    ...instructions.map((step, i) => [String(i + 1), step]),
  ];

  const csvContent = rows
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${sanitizeFilename(name)}.csv`);
}

export function downloadRecipeAsPdf(recipe: SupabaseRecipe, language: Language) {
  const loc = getLocalizedRecipe(recipe, language);
  const name = loc.name || recipe.name;
  const ingredients = loc.ingredients || [];
  const instructions = loc.instructions || [];

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(name, maxWidth);
  checkPage(titleLines.length * 8);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // Meta info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const meta: string[] = [];
  if (recipe.cuisine) meta.push(`${language === 'zh' ? '菜系' : 'Cuisine'}: ${recipe.cuisine}`);
  if (recipe.difficulty) meta.push(`${language === 'zh' ? '难度' : 'Difficulty'}: ${recipe.difficulty}`);
  if (recipe.prep_time) meta.push(`${language === 'zh' ? '准备' : 'Prep'}: ${recipe.prep_time}min`);
  if (recipe.cook_time) meta.push(`${language === 'zh' ? '烹饪' : 'Cook'}: ${recipe.cook_time}min`);
  if (recipe.calories) meta.push(`${recipe.calories} cal`);
  if (meta.length) {
    doc.text(meta.join('  |  '), margin, y);
    y += 8;
  }

  // Description
  if (loc.description) {
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(loc.description, maxWidth);
    checkPage(descLines.length * 5);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 6;
  }

  // Ingredients
  if (ingredients.length > 0) {
    y += 4;
    checkPage(14);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(language === 'zh' ? '食材' : 'Ingredients', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    for (const ing of ingredients) {
      checkPage(6);
      const line = `• ${ing.amount} ${ing.name}`;
      const lines = doc.splitTextToSize(line, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 1;
    }
  }

  // Instructions
  if (instructions.length > 0) {
    y += 6;
    checkPage(14);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(language === 'zh' ? '做法' : 'Instructions', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    instructions.forEach((step, i) => {
      const text = `${i + 1}. ${step}`;
      const lines = doc.splitTextToSize(text, maxWidth);
      checkPage(lines.length * 5 + 2);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 3;
    });
  }

  doc.save(`${sanitizeFilename(name)}.pdf`);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fff\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMultipleRecipesAsCsv(recipes: SupabaseRecipe[], language: Language) {
  const headers = language === 'zh'
    ? ['食谱名称', '描述', '菜系', '难度', '准备时间(分钟)', '烹饪时间(分钟)', '卡路里', '食材', '步骤']
    : ['Recipe Name', 'Description', 'Cuisine', 'Difficulty', 'Prep Time (min)', 'Cook Time (min)', 'Calories', 'Ingredients', 'Instructions'];

  const rows = recipes.map(recipe => {
    const loc = getLocalizedRecipe(recipe, language);
    const ingredients = (loc.ingredients || []).map(i => `${i.amount} ${i.name}`).join('; ');
    const instructions = (loc.instructions || []).map((s, i) => `${i + 1}. ${s}`).join('; ');
    return [
      loc.name || recipe.name,
      loc.description || '',
      recipe.cuisine || '',
      recipe.difficulty || '',
      String(recipe.prep_time || ''),
      String(recipe.cook_time || ''),
      String(recipe.calories || ''),
      ingredients,
      instructions,
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `recipes_export.csv`);
}

export function downloadMultipleRecipesAsPdf(recipes: SupabaseRecipe[], language: Language) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  recipes.forEach((recipe, idx) => {
    if (idx > 0) doc.addPage();
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const loc = getLocalizedRecipe(recipe, language);
    const name = loc.name || recipe.name;
    const ingredients = loc.ingredients || [];
    const instructions = loc.instructions || [];

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(name, maxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const meta: string[] = [];
    if (recipe.cuisine) meta.push(`${language === 'zh' ? '菜系' : 'Cuisine'}: ${recipe.cuisine}`);
    if (recipe.difficulty) meta.push(`${language === 'zh' ? '难度' : 'Difficulty'}: ${recipe.difficulty}`);
    if (recipe.prep_time) meta.push(`${language === 'zh' ? '准备' : 'Prep'}: ${recipe.prep_time}min`);
    if (recipe.cook_time) meta.push(`${language === 'zh' ? '烹饪' : 'Cook'}: ${recipe.cook_time}min`);
    if (recipe.calories) meta.push(`${recipe.calories} cal`);
    if (meta.length) { doc.text(meta.join('  |  '), margin, y); y += 8; }

    if (loc.description) {
      const descLines = doc.splitTextToSize(loc.description, maxWidth);
      checkPage(descLines.length * 5);
      doc.text(descLines, margin, y);
      y += descLines.length * 5 + 6;
    }

    if (ingredients.length > 0) {
      y += 4; checkPage(14);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(language === 'zh' ? '食材' : 'Ingredients', margin, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      for (const ing of ingredients) {
        checkPage(6);
        const lines = doc.splitTextToSize(`• ${ing.amount} ${ing.name}`, maxWidth);
        doc.text(lines, margin, y); y += lines.length * 5 + 1;
      }
    }

    if (instructions.length > 0) {
      y += 6; checkPage(14);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(language === 'zh' ? '做法' : 'Instructions', margin, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      instructions.forEach((step, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${step}`, maxWidth);
        checkPage(lines.length * 5 + 2);
        doc.text(lines, margin, y); y += lines.length * 5 + 3;
      });
    }
  });

  doc.save('recipes_export.pdf');
}

export const generateRIS = (data: any[]): string => {
  let risContent = '';

  data.forEach(item => {
    risContent += 'TY  - JOUR\n';
    
    if (item.title) {
      risContent += `TI  - ${item.title}\n`;
    }
    
    if (item.authors) {
      if (Array.isArray(item.authors)) {
        item.authors.forEach((author: any) => {
          let authorName = typeof author === 'string' ? author : 
                           (author.name || `${author.given || ''} ${author.family || ''}`.trim());
          if (authorName && authorName !== 'undefined') risContent += `AU  - ${authorName}\n`;
        });
      } else if (typeof item.authors === 'string') {
        const authorsList = item.authors.split(',');
        authorsList.forEach((a: string) => {
          let authorName = a.replace(/undefined/gi, '').trim();
          // Bersihkan data lama yang terlanjur menyimpan tahun seperti "(2020)"
          authorName = authorName.replace(/\s*\(\d{4}\)\s*/g, ' ').trim();
          if (authorName) risContent += `AU  - ${authorName}\n`;
        });
      }
    }

    if (item.abstract) {
      const cleanAbstract = item.abstract.replace(/\r?\n|\r/g, ' ');
      risContent += `AB  - ${cleanAbstract}\n`;
    }

    if (item.journal_name) {
      risContent += `JO  - ${item.journal_name}\n`;
    }

    if (item.volume) {
      risContent += `VL  - ${item.volume}\n`;
    }

    if (item.issue) {
      risContent += `IS  - ${item.issue}\n`;
    }

    if (item.pages) {
      const pages = item.pages.split('-');
      if (pages.length === 2) {
        risContent += `SP  - ${pages[0].trim()}\n`;
        risContent += `EP  - ${pages[1].trim()}\n`;
      } else {
        risContent += `SP  - ${item.pages.trim()}\n`;
      }
    }

    if (item.keywords) {
      const kwList = item.keywords.split(',');
      kwList.forEach((kw: string) => {
        if (kw.trim()) risContent += `KW  - ${kw.trim()}\n`;
      });
    }

    if (item.doi) {
      risContent += `DO  - ${item.doi}\n`;
    }

    if (item.year_published) {
      risContent += `PY  - ${item.year_published}\n`;
    } else if (item.yearPublished) {
      risContent += `PY  - ${item.yearPublished}\n`;
    }

    if (item.pdf_drive_link) {
      risContent += `UR  - ${item.pdf_drive_link}\n`;
    }

    risContent += 'ER  - \n\n';
  });

  return risContent;
};

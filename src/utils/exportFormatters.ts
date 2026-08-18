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
        authorsList.forEach(a => {
          const authorName = a.replace(/undefined/gi, '').trim();
          if (authorName) risContent += `AU  - ${authorName}\n`;
        });
      }
    }

    if (item.abstract) {
      const cleanAbstract = item.abstract.replace(/\r?\n|\r/g, ' ');
      risContent += `AB  - ${cleanAbstract}\n`;
    }

    if (item.doi) {
      risContent += `DO  - ${item.doi}\n`;
    }

    if (item.yearPublished) {
      risContent += `PY  - ${item.yearPublished}\n`;
    } else if (item.date) {
      risContent += `PY  - ${item.date}\n`;
    }

    if (item.pdf_drive_link) {
      risContent += `UR  - ${item.pdf_drive_link}\n`;
    }

    risContent += 'ER  - \n\n';
  });

  return risContent;
};

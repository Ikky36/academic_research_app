export async function getPdfUrlFromUnpaywall(doi: string): Promise<string | null> {
  if (!doi) return null;
  
  const email = 'zulkifli02hayad@gmail.com';
  const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null; // Not found in unpaywall
      throw new Error(`Unpaywall API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if open access
    if (data.is_oa && data.best_oa_location && data.best_oa_location.url_for_pdf) {
      return data.best_oa_location.url_for_pdf;
    }
    
    return null;
  } catch (err) {
    console.error('Error fetching from Unpaywall:', err);
    return null;
  }
}

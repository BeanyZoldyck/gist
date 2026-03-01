export interface YouTubeMetadata {
  title: string
  channel: string
  description: string
  uploadDate?: string
  viewCount?: string
  category?: string
  keywords?: string[]
}

export function extractYouTubeMetadata(): YouTubeMetadata {
  const metadata: YouTubeMetadata = {
    title: '',
    channel: '',
    description: '',
  }

  // Try to get title from multiple sources
  const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer') ||
                  document.querySelector('h1.title') ||
                  document.querySelector('ytd-watch-metadata h1')
  metadata.title = titleEl?.textContent?.trim() || document.title

  // Get channel name
  const channelEl = document.querySelector('#channel-name #text') ||
                    document.querySelector('ytd-channel-name a') ||
                    document.querySelector('#owner-name a')
  metadata.channel = channelEl?.textContent?.trim() || ''

  // Get description
  const descriptionEl = document.querySelector('#description #text') ||
                        document.querySelector('#description-inner')
  metadata.description = descriptionEl?.textContent?.trim() || ''

  // Try to get structured data from meta tags
  const metaTags = document.querySelectorAll('meta')
  metaTags.forEach(meta => {
    const property = meta.getAttribute('property') || meta.getAttribute('name')
    const content = meta.getAttribute('content')
    
    if (!content) return

    if (property === 'og:title' && !metadata.title) {
      metadata.title = content
    } else if (property === 'og:site_name' && !metadata.channel) {
      // YouTube
    } else if (property === 'og:description' && !metadata.description) {
      metadata.description = content
    } else if (property === 'video:upload_date') {
      metadata.uploadDate = content
    } else if (property === 'video:tag') {
      metadata.keywords = metadata.keywords || []
      metadata.keywords.push(content)
    }
  })

  // Get view count and upload date from video info
  const infoText = document.querySelector('#info-text')?.textContent?.trim() || ''
  const viewMatch = infoText.match(/([\d,\.]+[KMB]?)\s*views?/i)
  if (viewMatch) {
    metadata.viewCount = viewMatch[1]
  }

  // Get category if available
  const categoryEl = document.querySelector('a[href*="/playlist?list="]')
  if (categoryEl) {
    metadata.category = categoryEl.textContent?.trim()
  }

  return metadata
}

export function isYouTubeVideo(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
  } catch {
    return false
  }
}

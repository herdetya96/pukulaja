/* Slash Photo — default data.
   Everything here is only the starting point: categories, presets and settings
   are all editable inside the app and persisted on the device. */
(() => {
  'use strict';

  const categories = [
    { id: 'camera',    name: 'Camera Angles',       emoji: '🎥', color: '#0A84FF' },
    { id: 'lighting',  name: 'Flash & Lighting',    emoji: '⚡', color: '#FFD60A' },
    { id: 'film',      name: 'Film & Retro',        emoji: '🎞', color: '#FF9F0A' },
    { id: 'cinema',    name: 'Cinematic',           emoji: '🎬', color: '#FF453A' },
    { id: 'fashion',   name: 'Fashion & Editorial', emoji: '👠', color: '#FF375F' },
    { id: 'surreal',   name: 'Creative & Surreal',  emoji: '🌀', color: '#BF5AF2' },
    { id: 'insta',     name: 'Instagram-Worthy',    emoji: '✨', color: '#30D158' },
  ];

  // [command, display name, prompt]
  const raw = {
    camera: [
      ['droneview', 'Drone View', 'Transform this photo into a dramatic overhead drone shot, looking straight down at the subject.'],
      ['wormview', 'Worm’s-Eye View', 'Recreate this photo from ground level, looking dramatically upward at the subject.'],
      ['fisheye', 'Fisheye', 'Apply a 180-degree fisheye lens effect with curved edges and exaggerated perspective.'],
      ['pointfive', '0.5× Ultra-Wide', 'Make this look like a playful 0.5x ultra-wide smartphone photo with exaggerated proportions.'],
      ['birdseye', 'Bird’s-Eye', 'Create a high-angle bird’s-eye composition showing the subject and surroundings.'],
      ['povshot', 'POV Shot', 'Recreate the scene from a first-person perspective, as if someone else is looking at the subject.'],
      ['dutchangle', 'Dutch Angle', 'Tilt the camera dramatically for a dynamic, cinematic composition.'],
      ['groundcam', 'Ground Cam', 'Place the camera directly on the ground, emphasizing foreground objects and depth.'],
      ['reflectionshot', 'Reflection Shot', 'Reframe the subject as a reflection in a puddle, mirror, or glass surface.'],
      ['throughglass', 'Through Glass', 'Photograph the subject through a window with natural reflections and layered depth.'],
      ['overtheshoulder', 'Over the Shoulder', 'Recreate the image from behind the subject’s shoulder, looking toward the scene.'],
      ['telephoto', 'Telephoto 200mm', 'Simulate a 200mm telephoto lens with compressed background perspective.'],
      ['macroshot', 'Macro Shot', 'Create an extreme close-up with intricate detail and shallow depth of field.'],
      ['widecinema', 'Wide Cinema', 'Transform the composition into a wide cinematic frame with dramatic environmental scale.'],
      ['securitycam', 'Security Cam', 'Make the photo look like CCTV footage from a high corner-mounted security camera.'],
    ],
    lighting: [
      ['nighttimeflash', 'Nighttime Flash', 'Turn the scene into nighttime with strong direct-camera flash and a darker background.'],
      ['goldenhour', 'Golden Hour', 'Add warm sunset lighting, soft shadows, and glowing golden highlights.'],
      ['bluehour', 'Blue Hour', 'Transform the scene into blue hour, with a cool twilight sky and subtle ambient lighting.'],
      ['neonglow', 'Neon Glow', 'Add colorful neon lighting that realistically illuminates the subject and surroundings.'],
      ['spotlight', 'Spotlight', 'Illuminate the subject with a theatrical spotlight while the surroundings fade into darkness.'],
      ['silhouette', 'Silhouette', 'Turn the subject into a striking silhouette against a brightly lit background.'],
      ['sunflare', 'Sun Flare', 'Add natural lens flares and sun rays entering the camera.'],
      ['moonlight', 'Moonlight', 'Reimagine the photo under cool, soft moonlight with realistic nighttime shadows.'],
      ['candlelit', 'Candlelit', 'Light the scene using warm candlelight with intimate, soft shadows.'],
      ['projectorlight', 'Projector Light', 'Project abstract shapes, typography, or colorful patterns onto the subject.'],
      ['hardflash', 'Hard Flash', 'Apply harsh, direct editorial flash with crisp shadows and bright highlights.'],
      ['softbox', 'Softbox', 'Recreate the image with professional studio softbox lighting and natural skin tones.'],
      ['rimlight', 'Rim Light', 'Add a bright outline of light around the subject for cinematic separation.'],
      ['windowlight', 'Window Light', 'Simulate beautiful natural window lighting with gentle directional shadows.'],
      ['discolight', 'Disco Light', 'Add colorful disco-ball reflections scattered across the scene.'],
    ],
    film: [
      ['disposable', 'Disposable Camera', 'Make the photo look like a disposable film camera shot with grain, imperfect exposure, and nostalgic colors.'],
      ['polaroid', 'Polaroid', 'Transform the image into an instant-film photograph with faded colors and a classic white border.'],
      ['y2kdigital', 'Y2K Digital', 'Create a 2000s compact digital camera look with bright flash, digital noise, and timestamp.'],
      ['film35mm', '35mm Film', 'Recreate the photo as a 35mm film image with organic grain, soft highlights, and natural colors.'],
      ['vhsframe', 'VHS Frame', 'Turn the photo into a paused VHS recording with scan lines, analog distortion, and timestamp.'],
      ['camcorder', 'Camcorder', 'Make the image look like footage from an early-2000s handheld camcorder.'],
      ['filmnegative', 'Film Negative', 'Transform the image into a realistic photographic film negative with inverted colors.'],
      ['expiredfilm', 'Expired Film', 'Add faded tones, color shifts, and light leaks associated with expired film.'],
      ['lomography', 'Lomography', 'Create a saturated analog look with dark vignette and experimental color shifts.'],
      ['blackwhitefilm', 'B&W Film', 'Convert the photo into high-contrast black-and-white film photography with fine grain.'],
      ['lightleak', 'Light Leak', 'Add realistic red and orange film light leaks along the edges.'],
      ['vintagepostcard', 'Vintage Postcard', 'Turn the photo into a nostalgic travel postcard with faded print texture.'],
      ['paparazzi2000', 'Paparazzi 2000', 'Recreate the photo as an early-2000s celebrity paparazzi shot with direct flash.'],
      ['filmcontact', 'Film Contact Sheet', 'Display the photo as part of a film contact sheet with multiple frames and numbering.'],
      ['retrobooth', 'Retro Photo Booth', 'Turn the photo into a vertical strip of four vintage photo-booth portraits.'],
    ],
    cinema: [
      ['moviestill', 'Movie Still', 'Transform the photo into a cinematic movie frame with professional color grading and dramatic lighting.'],
      ['dreamsequence', 'Dream Sequence', 'Give the photo a surreal dream-sequence look with soft focus, glowing highlights, and ethereal colors.'],
      ['thrillerscene', 'Thriller Scene', 'Turn the photo into a suspenseful thriller scene with moody shadows and dramatic contrast.'],
      ['romcomscene', 'Rom-Com Scene', 'Make the photo look like a cheerful romantic-comedy movie frame with warm colors.'],
      ['horrorframe', 'Horror Frame', 'Reimagine the scene as an atmospheric horror movie still with eerie lighting and fog.'],
      ['wespalette', 'Pastel Symmetry', 'Apply symmetrical framing, pastel colors, and a whimsical vintage-film aesthetic.'],
      ['noirscene', 'Noir Scene', 'Transform the photo into a classic film-noir scene with dramatic black-and-white shadows.'],
      ['scifiscene', 'Sci-Fi Scene', 'Place the subject in a futuristic cinematic environment with realistic sci-fi lighting.'],
      ['apocalypse', 'Apocalypse', 'Reimagine the surroundings as an abandoned, overgrown post-apocalyptic world.'],
      ['fantasyrealm', 'Fantasy Realm', 'Transform the background into a magical fantasy setting with atmospheric lighting.'],
      ['underwaterscene', 'Underwater', 'Make the scene appear submerged underwater with floating hair, bubbles, and blue-green lighting.'],
      ['rainyscene', 'Rainy Scene', 'Add cinematic rainfall, wet surfaces, reflections, and an overcast atmosphere.'],
      ['snowfall', 'Snowfall', 'Transform the environment into a snowy winter scene with realistic snow accumulation.'],
      ['desertscene', 'Desert Scene', 'Reimagine the surroundings as a vast desert landscape with warm cinematic light.'],
      ['foggycinema', 'Foggy Cinema', 'Add atmospheric fog, diffused lighting, and cinematic depth.'],
    ],
    fashion: [
      ['voguecover', 'Fashion Cover', 'Turn the photo into a high-fashion magazine cover with editorial lighting, elegant typography, and premium styling.'],
      ['streetstyle', 'Street Style', 'Transform the photo into a candid street-style fashion photograph with natural movement and editorial framing.'],
      ['runwaylook', 'Runway Look', 'Reimagine the subject walking down a fashion runway with professional show lighting.'],
      ['luxurycampaign', 'Luxury Campaign', 'Turn the photo into a luxury fashion advertising campaign with sophisticated composition.'],
      ['beautyeditorial', 'Beauty Editorial', 'Create a high-end beauty campaign portrait with detailed skin texture and polished lighting.'],
      ['studioseamless', 'Studio Seamless', 'Place the subject against a seamless studio backdrop with professional lighting.'],
      ['mirrorcampaign', 'Mirror Campaign', 'Create an artistic fashion photograph using multiple mirrors and reflections.'],
      ['motioneditorial', 'Motion Editorial', 'Add tasteful motion blur around a sharply focused subject for a dynamic fashion photograph.'],
      ['paparazziflash', 'Paparazzi Flash', 'Recreate the photo as a candid celebrity street photograph taken with direct flash.'],
      ['coverstory', 'Cover Story', 'Turn the image into an editorial magazine cover with bold headlines and carefully composed typography.'],
      ['monochromefashion', 'Monochrome Fashion', 'Restyle the photo using a cohesive monochromatic fashion color palette.'],
      ['wetlook', 'Wet Look', 'Create a dramatic fashion editorial with wet hair, water droplets, and glossy reflections.'],
      ['shadowplay', 'Shadow Play', 'Add artistic geometric shadows across the subject and surroundings.'],
      ['highkey', 'High Key', 'Create a bright, airy studio fashion portrait with a white backdrop and soft shadows.'],
      ['lowkey', 'Low Key', 'Create a dark, dramatic portrait using controlled lighting and deep shadows.'],
    ],
    surreal: [
      ['miniatureme', 'Miniature Me', 'Shrink the subject into a tiny realistic miniature person interacting with oversized everyday objects.'],
      ['levitate', 'Levitate', 'Make the subject appear to float naturally above the ground with realistic shadows.'],
      ['cloneme', 'Clone Me', 'Create multiple realistic copies of the subject interacting within the same scene.'],
      ['snowglobe', 'Snow Globe', 'Place the subject and surroundings inside a realistic glass snow globe.'],
      ['giantme', 'Giant Me', 'Transform the subject into a giant person towering over a miniature city.'],
      ['papercut', 'Paper Cut', 'Recreate the photo as layered paper-cut artwork with realistic depth and shadows.'],
      ['clayworld', 'Clay World', 'Turn the subject and surroundings into a handcrafted claymation scene.'],
      ['toybox', 'Toy Box', 'Transform the subject into a collectible action figure inside realistic toy packaging.'],
      ['dollhouse', 'Dollhouse', 'Reimagine the scene as a miniature dollhouse with intricate details.'],
      ['pixelworld', 'Pixel World', 'Convert the photo into detailed retro pixel art inspired by classic video games.'],
      ['hologram', 'Hologram', 'Make the subject appear as a translucent futuristic holographic projection.'],
      ['doubleexposure', 'Double Exposure', 'Blend the subject’s silhouette with a landscape or cityscape using double exposure.'],
      ['portalworld', 'Portal World', 'Add a glowing portal opening into another realistic world within the scene.'],
      ['surrealclouds', 'Surreal Clouds', 'Surround the subject with oversized, dreamlike clouds while maintaining photorealistic lighting.'],
      ['glassfigure', 'Glass Figure', 'Transform the subject into a translucent glass sculpture with realistic reflections and refraction.'],
    ],
    insta: [
      ['crowdblur', 'Crowd Blur', 'Keep the subject sharply focused while surrounding people appear blurred in motion.'],
      ['prismshot', 'Prism Shot', 'Add realistic prism reflections, rainbow light streaks, and optical distortions.'],
      ['papercollage', 'Paper Collage', 'Turn the photo into an artistic scrapbook collage with paper textures, stickers, and cutouts.'],
      ['magazinecutout', 'Magazine Cutout', 'Create an experimental editorial collage using duplicated cutouts of the subject.'],
      ['albumcover', 'Album Cover', 'Transform the photo into a stylish indie-music album cover with typography and artistic grading.'],
      ['contactsheet', 'Contact Sheet', 'Create a contact sheet of nine different cinematic compositions featuring the subject.'],
      ['chromatic', 'Chromatic', 'Add subtle RGB color separation around edges for a creative digital photography effect.'],
      ['tiltshift', 'Tilt-Shift', 'Apply realistic tilt-shift lens blur to make the scene resemble a miniature model.'],
      ['longexposure', 'Long Exposure', 'Simulate a long-exposure photograph with light trails and motion blur while keeping the subject sharp.'],
      ['papercutout3d', '3D Paper Diorama', 'Turn the photo into a layered 3D paper diorama with dimensional cutouts and realistic shadows.'],
    ],
  };

  const presets = [];
  for (const cat of categories) {
    for (const [cmd, name, prompt] of raw[cat.id]) {
      presets.push({ id: cmd, cmd, name, prompt, cat: cat.id, aspect: '', fav: false, hidden: false, builtin: true });
    }
  }

  const providers = {
    gemini: {
      label: 'Google Gemini',
      keyHint: 'AIza…',
      keyUrl: 'aistudio.google.com/apikey',
      model: 'gemini-3.1-flash-image',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      suggestions: ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'],
    },
    openai: {
      label: 'OpenAI',
      keyHint: 'sk-…',
      keyUrl: 'platform.openai.com/api-keys',
      model: 'gpt-image-1.5',
      baseUrl: 'https://api.openai.com/v1',
      suggestions: ['gpt-image-1.5', 'gpt-image-2', 'chatgpt-image-latest'],
    },
    openrouter: {
      label: 'OpenRouter / kompatibel',
      keyHint: 'sk-or-…',
      keyUrl: 'openrouter.ai/keys',
      model: 'google/gemini-2.5-flash-image',
      baseUrl: 'https://openrouter.ai/api/v1',
      suggestions: ['google/gemini-2.5-flash-image', 'google/gemini-3.1-flash-image', 'openai/gpt-image-1.5'],
    },
  };

  const config = {
    v: 1,
    app: { name: 'Slash Photo', accent: '#FFD60A', theme: 'auto', columns: 2 },
    ai: {
      provider: 'gemini',
      keys: { gemini: '', openai: '', openrouter: '' },
      gemini: { model: providers.gemini.model, baseUrl: providers.gemini.baseUrl },
      openai: { model: providers.openai.model, baseUrl: providers.openai.baseUrl, size: 'auto', quality: 'auto', fidelity: '' },
      openrouter: { model: providers.openrouter.model, baseUrl: providers.openrouter.baseUrl },
    },
    prompt: {
      prefix: '',
      suffix: 'Keep the subject’s identity, face, and outfit recognizable unless the instruction says otherwise. Return one finished image.',
      aspect: '',
      maxStack: 3,
    },
    image: { maxSide: 1536, quality: 0.9, autoSave: true, maxHistory: 60 },
    categories,
    presets,
  };

  window.SLASH_DEFAULTS = { config, providers };
})();

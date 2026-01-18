/**
 * AES-256-GCM Encryption Utilities using Web Crypto API
 */

/**
 * Derive a key from a password/roomId using PBKDF2
 * @param {string} password - The password/roomId to derive key from
 * @param {Uint8Array} salt - Optional salt (will generate if not provided)
 * @returns {Promise<{key: CryptoKey, salt: Uint8Array}>}
 */
async function deriveKey(password, salt = null) {
    // Generate salt if not provided
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }
  
    // Convert password to bytes
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
  
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
  
    // Derive key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  
    return { key, salt };
  }
  
  /**
   * Encrypt text using AES-256-GCM
   * @param {string} plaintext - Text to encrypt
   * @param {CryptoKey} key - Encryption key
   * @returns {Promise<string>} Base64 encoded encrypted data with IV and auth tag
   */
  async function encrypt(plaintext, key) {
    // Generate random IV (Initialization Vector) - 12 bytes for GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
  
    // Convert plaintext to bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
  
    // Encrypt using AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      key,
      data
    );
  
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
  
    // Convert to base64 for transmission
    return btoa(String.fromCharCode(...combined));
  }
  
  /**
   * Decrypt text using AES-256-GCM
   * @param {string} encryptedBase64 - Base64 encoded encrypted data
   * @param {CryptoKey} key - Decryption key
   * @returns {Promise<string>} Decrypted plaintext
   */
  async function decrypt(encryptedBase64, key) {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
    // Extract IV (first 12 bytes) and encrypted data (rest)
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
  
    // Decrypt using AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      encrypted
    );
  
    // Convert bytes back to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
  
  /**
   * Encrypt translation using roomId as key derivation source
   * @param {string} translation - Translation text to encrypt
   * @param {string} roomId - Room ID used for key derivation
   * @returns {Promise<string>} Encrypted translation (base64)
   */
  export async function encryptTranslation(translation, roomId) {
    // Derive key from roomId (both peers will derive same key from same roomId)
    const { key } = await deriveKey(roomId);
    return await encrypt(translation, key);
  }
  
  /**
   * Decrypt translation using roomId as key derivation source
   * @param {string} encryptedTranslation - Encrypted translation (base64)
   * @param {string} roomId - Room ID used for key derivation
   * @returns {Promise<string>} Decrypted translation
   */
  export async function decryptTranslation(encryptedTranslation, roomId) {
    // Derive key from roomId (same derivation as encryption)
    const { key } = await deriveKey(roomId);
    return await decrypt(encryptedTranslation, key);
  }
  
  /**
   * Alternative: Use a shared secret key directly (if you have one)
   */
  export async function encryptWithKey(plaintext, sharedSecretKey) {
    // Import the key if it's a base64 string
    const keyBuffer = Uint8Array.from(atob(sharedSecretKey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return await encrypt(plaintext, key);
  }
  
  export async function decryptWithKey(encryptedBase64, sharedSecretKey) {
    const keyBuffer = Uint8Array.from(atob(sharedSecretKey), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return await decrypt(encryptedBase64, key);
  }
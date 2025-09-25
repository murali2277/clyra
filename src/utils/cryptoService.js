import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

class CryptoService {
  constructor() {
    this.keyPair = nacl.box.keyPair();
  }

  encrypt(message, theirPublicKey) {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = naclUtil.decodeUTF8(JSON.stringify(message));
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      theirPublicKey,
      this.keyPair.secretKey
    );
    return {
      encrypted: naclUtil.encodeBase64(encrypted),
      nonce: naclUtil.encodeBase64(nonce),
    };
  }

  decrypt(encryptedMessage, nonce, theirPublicKey) {
    const decrypted = nacl.box.open(
      naclUtil.decodeBase64(encryptedMessage),
      naclUtil.decodeBase64(nonce),
      theirPublicKey,
      this.keyPair.secretKey
    );
    return JSON.parse(naclUtil.encodeUTF8(decrypted));
  }

  getPublicKey() {
    return this.keyPair.publicKey;
  }

  getPublicKeyBase64() {
    return naclUtil.encodeBase64(this.keyPair.publicKey);
  }

  decodePublicKey(base64PublicKey) {
    return naclUtil.decodeBase64(base64PublicKey);
  }
}

export default new CryptoService();

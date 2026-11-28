import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import domino from '@mixmark-io/domino';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DOMParser, DOMSerializer } from '@tiptap/pm/model';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/extensions/embedded-raster-image.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports = {};
vm.runInNewContext(compiled,{exports,require,atob});
const { EmbeddedRasterImage, isSmallEmbeddedRaster } = exports;
const schema = getSchema([StarterKit, EmbeddedRasterImage]);
const pngPayload='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=';
const png='data:image/png;base64,'+pngPayload;

test('preserves the original source and alt text for a supported embedded raster',()=>{
  assert.equal(isSmallEmbeddedRaster(png),true);
  const doc=domino.createWindow(`<p>before</p><img src="${png}" alt="그림"><p>after</p>`).document;
  const parsed=DOMParser.fromSchema(schema).parse(doc.body);
  assert.equal(parsed.child(1).type.name,'image');
  assert.equal(parsed.child(1).attrs.src,png);
  assert.equal(parsed.child(1).attrs.alt,'그림');
  const out=doc.createElement('div');
  out.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(parsed.content,{document:doc}));
  assert.equal(out.querySelector('img').getAttribute('src'),png);
});

test('rejects unsupported MIME, mismatched raster signatures, and excess bytes or declared dimensions',()=>{
  const oversizedImage=Buffer.from(pngPayload,'base64');
  oversizedImage.writeUInt32BE(10001,16);
  oversizedImage.writeUInt32BE(10000,20);
  for(const url of [
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/plain;base64,dGVzdA==',
    png.replace('image/png','image/gif'),
    'data:image/png;base64,!',
    'data:image/png;base64,'+Buffer.alloc(200*1024+1).toString('base64'),
    'data:image/png;base64,'+oversizedImage.toString('base64'),
  ]){
    assert.equal(isSmallEmbeddedRaster(url),false);
    const doc=domino.createWindow(`<img src="${url}">`).document;
    const parsed=DOMParser.fromSchema(schema).parse(doc.body);
    assert.equal(parsed.firstChild.type.name,'paragraph');
  }
});

test('keeps ordinary Markdown image URL parsing unchanged',()=>{
  for(const url of ['https://example.com/figure.png','./figure.png']){
    const doc=domino.createWindow(`<img src="${url}" alt="figure">`).document;
    const parsed=DOMParser.fromSchema(schema).parse(doc.body);
    assert.equal(parsed.firstChild.attrs.src,url);
  }
});

test('accepts small valid PNG, JPEG, BMP, GIF, and three WebP encodings',()=>{
  const fixtures = [
    ['png', 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFUlEQVR4nGOUSLNgYGBgYGBgYoABAAzoALo+44xAAAAAAElFTkSuQmCC'],
    ['jpeg', '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiKKKK5jwD/9k='],
    ['bmp', 'Qk1OAAAAAAAAADYAAAAoAAAAAwAAAAIAAAABABgAAAAAABgAAADEDgAAxA4AAAAAAAAAAAAAOGYYOGYYOGYYAAAAOGYYOGYYOGYYAAAA'],
    ['gif', 'R0lGODdhAwACAIEAABhmOAAAAAAAAAAAACwAAAAAAwACAAAIBgABCBwYEAA7'],
    ['webp', 'UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoDAAIAAUAmJaACdAFAAAD+9Bi2WZwr2X/8gx/oa/wV3YAA'],
    ['webp', 'UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAdQs2IUp/+BiOh/AAA='],
    ['webp', 'UklGRlYAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAfX19fX19AFZQOCAoAAAAcAEAnQEqAwACAAFAJiWgAnQBQAAA/vQYtlmcK9l//IMf6Gv8Fd2AAA=='],
  ];
  for(const [mime,base64] of fixtures) assert.ok(isSmallEmbeddedRaster(`data:image/${mime};base64,${base64}`),mime);
});

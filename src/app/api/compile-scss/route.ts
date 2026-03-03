import { NextRequest, NextResponse } from 'next/server';
import * as sass from 'sass';

const GLOBAL_VAR_SHIM = `
$colors: (
  '01': #ffffff, '02': #383b3e, '03': #606366, '07': #f2f3f2,
  '10': #6e1634, '11': #8b1d41, '90': #5a1029, '112': #f5f0f2,
);
@function color($key) { @return map-get($colors, $key); }
$mobile: "(max-width: 640px)";
@mixin fontMixin($size, $family: 'Open Sans', $weight: normal) {
  font-size: #{$size}px;
  font-family: 'Open Sans', Arial, sans-serif;
}
`;

export async function POST(req: NextRequest) {
  try {
    const { scss } = await req.json();
    if (!scss || typeof scss !== 'string') {
      return NextResponse.json({ error: 'Missing scss string' }, { status: 400 });
    }
    let content = scss.replace(/@import\s+["'][^"']*globalVar[^"']*["']\s*;/g, '');
    content = content.replace(/::ng-deep\s*/g, '');
    const compiled = sass.compileString(GLOBAL_VAR_SHIM + '\n' + content, { style: 'expanded' });
    return NextResponse.json({ css: compiled.css });
  } catch (e) {
    return NextResponse.json({ css: `/* SCSS error: ${(e as Error).message} */` });
  }
}

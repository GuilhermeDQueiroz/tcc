"""Read-only SQL lineage: source aliases, raw columns and dialect adaptation."""
import ast
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]
QUERY_NAMES={'abertos':'QUERY_ABERTOS','emitidos':'QUERY_EMITIDOS','faturados':'QUERY_FATURADOS','carteira':'QUERY_CARTEIRA','metas':'QUERY_METAS_CONSULTORES'}
KEYWORDS={'ON','WHERE','INNER','LEFT','RIGHT','FULL','CROSS','JOIN','GROUP','ORDER','UNION','HAVING','LIMIT'}

def queries():
    return {name:(ROOT/f'etl/sql/fontes/{name}.sql').read_text(encoding='utf-8').strip() for name in QUERY_NAMES.values()}

TABLE_REFERENCE=re.compile(r'\b(from|join)\s+([A-Z_][\w$]*)\b(?!\.)(?:\s+(?:as\s+)?([A-Z_][\w$]*))?',re.I)

def raw_columns():
    columns={}
    for query in queries().values():
        aliases={}
        for match in TABLE_REFERENCE.finditer(query):
            table=match[2].upper()
            if table=='RDB$DATABASE':continue
            alias=(match[3] or '').upper()
            aliases[table]=table
            if alias and alias not in KEYWORDS:aliases[alias]=table
        for alias,column in re.findall(r'\b([A-Z_][\w$]*)\.([A-Z_][\w$]*)\b',query,re.I):
            table=aliases.get(alias.upper())
            if table:columns.setdefault(table,set()).add(column.upper())
    return {table:sorted(fields) for table,fields in sorted(columns.items())}

def replace_iif(text):
    # Parse commas at the current nesting level, preserving strings and nesting.
    while match:=re.search(r'\biif\s*\(',text,re.I):
        start=match.end();depth=1;quoted=False;parts=[];part=start;i=start
        while i<len(text):
            char=text[i]
            if char=="'":
                if quoted and i+1<len(text) and text[i+1]=="'":i+=2;continue
                quoted=not quoted
            if not quoted:
                if char=='(':depth+=1
                elif char==')':
                    depth-=1
                    if depth==0:parts.append(text[part:i]);break
                elif char==',' and depth==1:parts.append(text[part:i]);part=i+1
            i+=1
        if len(parts)!=3:raise ValueError('IIF não reconhecido')
        condition,yes,no=map(replace_iif,parts)
        text=text[:match.start()]+f'(CASE WHEN {condition} THEN {yes} ELSE {no} END)'+text[i+1:]
    return text

def to_postgres(query):
    tables=raw_columns()
    def reference(match):
        table=match[2].upper()
        if table not in tables:return match[0]
        alias=match[3]
        if alias and alias.upper() not in KEYWORDS:
            return f'{match[1]} staging.stg_{table.lower()} {alias}'
        suffix=(' '+alias) if alias else ''
        return f'{match[1]} staging.stg_{table.lower()} {table}'+suffix
    result=replace_iif(query)
    # Firebird exact numeric division has scale 6 here and truncates toward zero.
    # Verified against 10,000 actual item records: trunc matched all; round did not.
    result=re.sub(r'(DOCUMENTO_ITEM_DETALHE\.VLRBRUTOLIQUIDO_DOCITEMDET)\s*/\s*(DOCUMENTO_ITEM_DETALHE\.QTDECHAPAS_DOCITEMDET)',r'TRUNC(\1 / \2, 6)',result,flags=re.I)
    result=TABLE_REFERENCE.sub(reference,result)
    # The source/result metadata declares naive timestamps. PostgreSQL
    # CURRENT_TIMESTAMP would promote the metas UNION to timestamptz;
    # pandas then converts it to UTC, unlike the original Firebird output.
    result=re.sub(r'\bCURRENT_TIMESTAMP\b','LOCALTIMESTAMP',result,flags=re.I)
    result=re.sub(r'\bfrom\s+RDB\$DATABASE\b','',result,flags=re.I)
    return result

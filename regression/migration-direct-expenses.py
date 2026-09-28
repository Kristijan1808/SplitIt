"""Exercise migration data-copy SQL against SQLite fixtures; not a PostgreSQL deployment test."""
import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
schemas={
'expenses':'id TEXT PRIMARY KEY, groupId TEXT, creatorKey TEXT, sourceDraftId TEXT UNIQUE, totalAmount NUMERIC, note TEXT, createdAt TEXT, updatedAt TEXT, billDate TEXT, category TEXT',
'expense_payers':'id TEXT PRIMARY KEY, expenseId TEXT, personId TEXT, amount NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_items':'id TEXT PRIMARY KEY, expenseId TEXT, ordinalNumber INTEGER, name TEXT, price NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_item_shares':'id TEXT PRIMARY KEY, itemId TEXT, personId TEXT, amount NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_shares':'id TEXT PRIMARY KEY, expenseId TEXT, personId TEXT, amount NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_drafts':'id TEXT PRIMARY KEY, groupId TEXT, creatorKey TEXT, requestId TEXT, confirmedExpenseId TEXT, note TEXT, createdAt TEXT, updatedAt TEXT, billDate TEXT, category TEXT',
'expense_draft_payers':'id TEXT PRIMARY KEY, draftId TEXT, personId TEXT, amount NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_draft_items':'id TEXT PRIMARY KEY, draftId TEXT, ordinalNumber INTEGER, name TEXT, price NUMERIC, createdAt TEXT, updatedAt TEXT',
'expense_draft_item_shares':'id TEXT PRIMARY KEY, itemId TEXT, personId TEXT, amount NUMERIC, createdAt TEXT, updatedAt TEXT'}
for table,schema in schemas.items():c.execute(f'CREATE TABLE "{table}" ({schema})')
for id,confirmed in [('waiting',None),('done','existing'),('no-payer',None)]:
 c.execute('INSERT INTO expense_drafts VALUES (?,?,?,?,?,?,?,?,?,?)',(id,'g','owner',id+'-request',confirmed,id,'date','date','date','food'))
 c.execute('INSERT INTO expense_draft_items VALUES (?,?,?,?,?,?,?)',(id+'-item',id,1,'Plata',20,'date','date'))
 if id!='no-payer':c.execute('INSERT INTO expense_draft_payers VALUES (?,?,?,?,?,?)',(id+'-payer',id,'a',20,'date','date'))
c.execute('INSERT INTO expense_draft_item_shares VALUES (?,?,?,?,?,?)',('s','waiting-item','b',20,'date','date'))
sql=(Path(__file__).parent.parent/'apps/api/prisma/migrations/202609280001_direct_expenses/migration.sql').read_text()
# SQLite does not support PostgreSQL ADD CONSTRAINT. Copy statements run unchanged.
copy_sql=sql[:sql.index('-- Block old server instances')]
c.executescript(copy_sql)
assert c.execute('SELECT COUNT(*) FROM expense_drafts WHERE confirmedExpenseId IS NULL').fetchone()[0]==0
assert c.execute('SELECT COUNT(*) FROM expenses').fetchone()[0]==2
assert c.execute('SELECT totalAmount,requestId FROM expenses WHERE id="waiting"').fetchone()==(20,'waiting-request')
assert c.execute('SELECT quantity FROM expense_items WHERE id="waiting-item"').fetchone()[0]==1
assert c.execute('SELECT amount FROM expense_shares WHERE expenseId="waiting"').fetchone()[0]==20
assert c.execute('SELECT COUNT(*) FROM expense_drafts').fetchone()[0]==3
assert c.execute('SELECT confirmedExpenseId FROM expense_drafts WHERE id="done"').fetchone()[0]=='existing'
assert c.execute('SELECT confirmedExpenseId FROM expense_drafts WHERE id="no-payer"').fetchone()[0]=='no-payer'
print('PASS: unconfirmed drafts imported once, claims/payments/quantity preserved, confirmed and incomplete legacy records retained')

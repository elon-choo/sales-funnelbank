// scripts/create-chat-tables.js
// 대화 히스토리 테이블 생성
const { Client } = require('pg');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function createChatTables() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('데이터베이스 연결 중...');
        await client.connect();
        console.log('연결 성공!\n');

        // 1. chat_sessions 테이블 생성
        console.log('1. chat_sessions 테이블 생성 중...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                title VARCHAR(255) DEFAULT '새 대화',
                landing_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
                message_count INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                last_message_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
            );
        `);
        console.log('   chat_sessions 테이블 생성 완료!');

        // 2. chat_messages 테이블 생성
        console.log('2. chat_messages 테이블 생성 중...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('   chat_messages 테이블 생성 완료!');

        // 3. 인덱스 생성
        console.log('3. 인덱스 생성 중...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
        `);
        console.log('   인덱스 생성 완료!');

        // 4. 트리거 함수 생성 (메시지 추가 시 세션 업데이트)
        console.log('4. 트리거 함수 생성 중...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_chat_session_on_message()
            RETURNS TRIGGER AS $$
            BEGIN
                UPDATE chat_sessions
                SET
                    message_count = message_count + 1,
                    total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
                    last_message_at = NEW.created_at,
                    updated_at = NOW()
                WHERE id = NEW.session_id;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 트리거 생성
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_update_session_on_message ON chat_messages;
            CREATE TRIGGER trigger_update_session_on_message
            AFTER INSERT ON chat_messages
            FOR EACH ROW
            EXECUTE FUNCTION update_chat_session_on_message();
        `);
        console.log('   트리거 생성 완료!');

        // 5. RLS 정책 설정
        console.log('5. RLS 정책 설정 중...');
        await client.query(`
            ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
            ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

            -- chat_sessions RLS
            DROP POLICY IF EXISTS "Users can view own sessions" ON chat_sessions;
            CREATE POLICY "Users can view own sessions" ON chat_sessions
                FOR SELECT USING (auth.uid() = user_id);

            DROP POLICY IF EXISTS "Users can insert own sessions" ON chat_sessions;
            CREATE POLICY "Users can insert own sessions" ON chat_sessions
                FOR INSERT WITH CHECK (auth.uid() = user_id);

            DROP POLICY IF EXISTS "Users can update own sessions" ON chat_sessions;
            CREATE POLICY "Users can update own sessions" ON chat_sessions
                FOR UPDATE USING (auth.uid() = user_id);

            -- chat_messages RLS (세션 소유자만 접근)
            DROP POLICY IF EXISTS "Users can view own messages" ON chat_messages;
            CREATE POLICY "Users can view own messages" ON chat_messages
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM chat_sessions
                        WHERE chat_sessions.id = chat_messages.session_id
                        AND chat_sessions.user_id = auth.uid()
                    )
                );

            DROP POLICY IF EXISTS "Users can insert own messages" ON chat_messages;
            CREATE POLICY "Users can insert own messages" ON chat_messages
                FOR INSERT WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM chat_sessions
                        WHERE chat_sessions.id = chat_messages.session_id
                        AND chat_sessions.user_id = auth.uid()
                    )
                );
        `);
        console.log('   RLS 정책 설정 완료!');

        // 테이블 구조 확인
        console.log('\n=== 생성된 테이블 확인 ===');

        const sessions = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'chat_sessions'
            ORDER BY ordinal_position;
        `);
        console.log('\nchat_sessions 컬럼:');
        sessions.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        const messages = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'chat_messages'
            ORDER BY ordinal_position;
        `);
        console.log('\nchat_messages 컬럼:');
        messages.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        console.log('\n대화 히스토리 테이블 생성 완료!');

    } catch (error) {
        console.error('오류:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

createChatTables();

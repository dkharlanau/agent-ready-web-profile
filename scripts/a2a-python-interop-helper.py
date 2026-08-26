#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from a2a.types.a2a_pb2 import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentSkill,
)
from a2a.utils import signing
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from google.protobuf.json_format import MessageToDict, ParseDict
from jwt.algorithms import ECAlgorithm

JWKS_URL = 'https://keys.example/python-jwks.json'
KID = 'a2a-python-interop-ec'


def reviewed_card() -> AgentCard:
    return AgentCard(
        name='ARWP A2A Python interoperability fixture',
        description='A non-empty v1 Agent Card used only for deterministic cross-language signature verification.',
        supported_interfaces=[
            AgentInterface(
                url='https://agent.example/a2a',
                protocol_binding='JSONRPC',
                protocol_version='1.0',
            )
        ],
        version='1.0.0',
        capabilities=AgentCapabilities(streaming=True),
        default_input_modes=['text/plain'],
        default_output_modes=['application/json'],
        skills=[
            AgentSkill(
                id='lookup',
                name='Lookup',
                description='Look up a deterministic fixture value.',
                tags=['lookup'],
            )
        ],
    )


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def sign_with_python_sdk(directory: Path) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    signer = signing.create_agent_card_signer(
        signing_key=private_key,
        protected_header={
            'alg': 'ES256',
            'kid': KID,
            'jku': JWKS_URL,
            'typ': 'JOSE',
        },
    )
    signed = signer(reviewed_card())
    signed_dict = MessageToDict(signed)
    write_json(directory / 'python-signed-card.json', signed_dict)

    jwk = json.loads(ECAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({'kid': KID, 'alg': 'ES256', 'use': 'sig'})
    write_json(directory / 'python-jwks.json', {'keys': [jwk]})
    (directory / 'python-canonical.txt').write_text(
        signing._canonicalize_agent_card(signed), encoding='utf-8'
    )


def verify_arwp_signature(directory: Path) -> None:
    signed_dict = json.loads((directory / 'arwp-signed-card.json').read_text(encoding='utf-8'))
    card = ParseDict(signed_dict, AgentCard())
    public_key = serialization.load_pem_public_key(
        (directory / 'arwp-public.pem').read_bytes()
    )

    def key_provider(kid: str | None, jku: str | None):
        assert kid == KID, f'unexpected kid: {kid}'
        assert jku == JWKS_URL, f'unexpected jku: {jku}'
        return public_key

    verifier = signing.create_signature_verifier(key_provider, ['ES256'])
    verifier(card)

    tampered = AgentCard()
    tampered.CopyFrom(card)
    tampered.description = 'Tampered after ARWP-compatible signing.'
    try:
        verifier(tampered)
    except signing.InvalidSignaturesError:
        pass
    else:
        raise AssertionError('Python SDK accepted a post-signing mutation.')

    print('PASS official a2a-sdk==1.1.2 verified ARWP-compatible ES256 signature and rejected tampering')


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in {'sign', 'verify'}:
        raise SystemExit('Usage: a2a-python-interop-helper.py <sign|verify> <directory>')
    directory = Path(sys.argv[2])
    directory.mkdir(parents=True, exist_ok=True)
    if sys.argv[1] == 'sign':
        sign_with_python_sdk(directory)
    else:
        verify_arwp_signature(directory)


if __name__ == '__main__':
    main()

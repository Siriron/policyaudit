import { PostForm } from '../components/Forms'

export default function NewPolicy() {
  return (
    <>
      <h1>Post a policy</h1>
      <p>Point at one file in a public GitHub repository, pinned to a full commit id, and state what you claim it says. Your bounty is
        locked until the window ends; if nobody reproduces a contradiction you take it back.</p>
      <PostForm />
    </>
  )
}
